import boto3
import json
from pdf2image import convert_from_path
from src.logs import intializeLogs
from src.helperFunctions import getReturnArray
from dotenv import load_dotenv
import io
import os
import re


# Initialize logging
logger = intializeLogs()

def extractTextFromImage(image):

    """
    Performs synchronization operation and suits for smaller document/pdf.
        - Two major parameters- Document & FeatureTypes -- allows the user to specify the type of analysis to perform
        -   TABLES - extracts table information in the form of cells
        -   FORMS - extracts structured data
        -   Output - will be in the form of json, in the form of blocks (objects)
    """
    try:
        load_dotenv()
        # Initialize Textract client with environment variables
        try:
            textract = boto3.client('textract', region_name= os.getenv('AWS_DEFAULT_REGION'), 
                                    aws_access_key_id= os.getenv('AWS_ACCESS_KEY_ID'), 
                                    aws_secret_access_key= os.getenv('AWS_SECRET_ACCESS_KEY'))
        except Exception as e:
            logger.error(f"Failed to initialize Textract client: {e}")
            return []
        


        imgByteArr = io.BytesIO()
        image.save(imgByteArr, format='PNG')
        imgBytes = imgByteArr.getvalue()

        
        response = textract.analyze_document(
            Document={'Bytes': imgBytes},
            FeatureTypes=['TABLES', 'FORMS']
        )

        return response['Blocks']
    except Exception as e:
        logger.error(f"Error extracting text from image: {e}")
    return []

def processBlocks(blocks):
    try:
        if not blocks:
            return {"keyValuePairs": [], "sectionHeaders": [], "tables": [], "rawText": []}

        blockMap = {block['Id']: block for block in blocks}
        
        keyValuePairs = []
        tables = []
        sectionHeaders = []
        rawText = []
        tableTexts = set()  

        # First pass: Build tables and extract table cell texts
        for block in blocks:
            if block['BlockType'] == 'TABLE':
                table_result = buildTable(block, blockMap)
                if table_result:
                    tables.append(table_result)
                    for row in table_result:
                        for cell in row:
                            cleaned = cell.strip().lower()
                            if cleaned:
                                tableTexts.add(cleaned)

        # Second pass: Process everything else
        for block in blocks:
            if block['BlockType'] == 'KEY_VALUE_SET':
                if 'KEY' in block.get('EntityTypes', []):
                    key_text = getTextFromChildren(block, blockMap)
                    value_text = ""
                    for rel in block.get('Relationships', []):
                        if rel['Type'] == 'VALUE':
                            for value_id in rel['Ids']:
                                if value_id in blockMap:
                                    value_text += getTextFromChildren(blockMap[value_id], blockMap) + " "
                    keyValuePairs.append((key_text.strip(), value_text.strip()))

            elif block['BlockType'] == 'LINE':
                text = block.get('Text', '').strip()
                if not text:
                    continue
                text_lower = text.lower()
                # Skip this line if it exactly matches any table cell or is part of one
                if any(text_lower in table_text or table_text in text_lower for table_text in tableTexts):
                    continue
                if text.startswith('##') or "summary" in text_lower or "results" in text_lower:
                    sectionHeaders.append(text)
                else:
                    rawText.append(text)

        return {
            "keyValuePairs": keyValuePairs,
            "sectionHeaders": sectionHeaders,
            "tables": tables,
            "rawText": rawText
        }

    except Exception as e:
        logger.error(f"Error processing blocks: {e}")
        return {
            "keyValuePairs": [],
            "sectionHeaders": [],
            "tables": [],
            "rawText": []
        }


def buildTable(tableBlock, blockMap):
    """
    Processes a table block and extracts its content into a 2D list.
        - For the given textract table block, creates 2D rows and columns into 2D List
        - Iterates over child blocks via Relationships and find the cell. 
        - creates the empty grid for the table
        - append each cell's word into the row[i] col[i] iteratively
    """
    try:
        cells = []
        for rel in tableBlock.get('Relationships', []):
            if rel['Type'] == 'CHILD':
                for cell_id in rel['Ids']:
                    if cell_id not in blockMap:
                        continue
                    cellBlock = blockMap[cell_id]
                    if cellBlock['BlockType'] != 'CELL':
                        continue
                    
                    cellText = getTextFromChildren(cellBlock, blockMap)
                    cells.append({
                        'row': cellBlock['RowIndex'],
                        'col': cellBlock['ColumnIndex'],
                        'text': cellText
                    })
        
        if not cells:
            return None
        
        maxRow = max(cell['row'] for cell in cells)
        maxCol = max(cell['col'] for cell in cells)
        table = [['' for _ in range(maxCol)] for _ in range(maxRow)]
        for cell in cells:
            if cell['row']-1 < len(table) and cell['col']-1 < len(table[0]):
                table[cell['row']-1][cell['col']-1] = cell['text']
        return table
    except Exception as e:
        logger.error(f"Error building table: {e}")
    return None

def getTextFromChildren(block, blockMap):
    try:
        text = ''
        for rel in block.get('Relationships', []):
            if rel['Type'] == 'CHILD':
                for child_id in rel['Ids']:
                    if child_id not in blockMap:
                        continue
                    child = blockMap[child_id]
                    if child['BlockType'] in ['WORD', 'LINE']:
                        text += child['Text'] + ' '
        return text.strip()
    except Exception as e:
        logger.error(f"Error getting text from children: {e}")
    return ''

def cleanTable(table):
    """ Cleans the table by removing empty rows and columns.
        - Removes rows that are completely empty
        - Removes columns that are completely empty
        - Returns a cleaned 2D list
    """
    try:
        if not table:
            return []
        
        # Remove empty rows and columns
        table = [row for row in table if any(cell.strip() for cell in row)]
        if not table:
            return []
        
        # Remove empty columns
        transposed = list(zip(*table))
        transposed = [col for col in transposed if any(cell.strip() for cell in col)]
        return list(zip(*transposed))
    except Exception as e:
        logger.error(f"Error cleaning table: {e}")
    return []

def tableToMarkdown(table):
    """
    Converts a 2D table into a Markdown formatted string.
        - Cleans the table first
        - Creates a Markdown table with headers and rows
        - Returns the Markdown string as per the expected format
        - If the table is empty, returns an empty string
    """
    try:
        if not table or not any(table):
            return ""
        cleaned = cleanTable(table)
        if not len(cleaned):
            return ""
        
        markdown = "| " + " | ".join(cleaned[0]) + " |\n"
        markdown += "| " + " | ".join(["---"] * len(cleaned[0])) + " |\n"
        for row in cleaned[1:]:
            markdown += "| " + " | ".join(row) + " |\n"
        return markdown.rstrip()
    except Exception as e:
        logger.error(f"Error converting table to markdown: {e}")
    return ""

def formatPageContent(result):
    """
    Formats the extracted content into a Markdown-like structure.
        - Combines key-value pairs, section headers, and tables into a single string
    """
    try:
        contentLines = []
        
        # Add section headers, body and tables
        for header in result["sectionHeaders"]:
            contentLines.append(f"## {header}")
            contentLines.append("")  # Empty line

            if result['rawText']:
                contentLines.append("")
                contentLines.append(result['rawText'].pop(0).strip())
                contentLines.append("")
            
            if result["tables"]:
                tableMd = tableToMarkdown(result["tables"].pop(0))
                if tableMd:
                    contentLines.append(tableMd)
                    contentLines.append("")
                
        # Add remaining raw text
        for text in result["rawText"]:
            if text.strip():
                contentLines.append(text.strip())
                contentLines.append("")

        # Add any remaining tables
        for table in result["tables"]:
            tableMd = tableToMarkdown(table)
            if tableMd:
                contentLines.append(tableMd)
                contentLines.append("")
        
        # If there are key-value pairs, add them at the end
        for key, value in result["keyValuePairs"]:
            contentLines.append(f"{key}")
            contentLines.append(value)
            contentLines.append("")

        
        # Join with actual newlines and clean up
        return "\n".join(contentLines).strip()
    except Exception as e:
        logger.error(f"Error formatting page content: {e}")
    return ""


def processPdfToJson(filePathInput, outputPath):
    
    """
        Main function to process the PDF and extract text.
    """
    try:
        if not os.path.exists(filePathInput):
            logger.error(f"PDF file not found: {filePathInput}")
            return {},''
        pages = convert_from_path(filePathInput)
        outputFileName = outputPath + '/' + os.path.basename(filePathInput).split('.')[0] + "_extracted.json"
        results = {}
        for i, page in enumerate(pages, start=1):
            logger.info(f"Processing page {i}...")
            blocks = extractTextFromImage(page)
            result = processBlocks(blocks)
            pageContent = formatPageContent(result)
            
            pageContent = re.sub(r'\n{3,}', '\n\n', pageContent)
            results[f"page_{i}"] = pageContent
        
        # Write JSON manually to preserve real line breaks
        with open(outputFileName, "w", encoding="utf-8") as f:
            f.write("{\n")
            for i, (page, text) in enumerate(results.items()):
                f.write(f'    "{page}": """\n{text}\n"""')
                if i < len(results) - 1:
                    f.write(",\n")
                else:
                    f.write("\n")
            f.write("}\n")

        logger.info(f"Text extraction completed. Output saved to {outputFileName}")
        return results,outputFileName

    except Exception as e:
        logger.error(f"Error processing scanned file: {e}")
    return {},''

def processScannedFile(filePathInput, outputPath):
    """
    Process a PDF file interactively by prompting the user for file path only.
    Output is always in JSON format.
    """
    try:
        logger.info(f"Processing {os.path.basename(filePathInput)} to JSON format...")
        result,outputFileName = processPdfToJson(filePathInput, outputPath)
        if result:
            data = {
                'result':result,
                'outputFileName': outputFileName
            }
            logger.info(f"Text extraction completed for {os.path.basename(filePathInput)}. Output saved to {outputPath}.")
            return getReturnArray(True, f"Text extraction completed for {filePathInput}", data)
        else:
            logger.error(f"Failed to extract text from {os.path.basename(filePathInput)}.")
            return getReturnArray(False, f"Failed to extract text from {os.path.basename(filePathInput)}", None)
    except Exception as e:
        logger.error(f"An error occurred while processing the file: {e}")
    return getReturnArray(False, f"An error occurred while processing the file: {e}", None)