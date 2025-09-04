import pdfplumber
import os
from src.logs import intializeLogs
from src.helperFunctions import getReturnArray

logger = intializeLogs()

def tableToMarkdown(table):
    """
    Convert a nested list table into Markdown-style table, handling None cells.
    """
    try:
        if not table:
            return ""
        # Convert header to string
        header = [str(cell) if cell is not None else "" for cell in table[0]]
        markdown = "| " + " | ".join(header) + " |\n"
        markdown += "| " + " | ".join(['---'] * len(header)) + " |\n"

        # Convert rows
        for row in table[1:]:
            rowCells = [str(cell) if cell is not None else "" for cell in row]
            markdown += "| " + " | ".join(rowCells) + " |\n"
        return markdown
    except Exception as e:
        logger.error(f"Error in converting table to markdown format: {e}")
    return ""

def processPdfToJson(filePathInput, outputPath):
    """
        Main function to process the PDF and extract text.
    """
        
    try:
        if not os.path.exists(filePathInput):
            logger.error(f"PDF file not found: {filePathInput}")
            return {},''
        outputFileName = outputPath + '/' + os.path.basename(filePathInput).split('.')[0] + "_extracted.json"
        results = {}
        with pdfplumber.open(filePathInput) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                logger.info(f"Processing page {page_num}...")
                page_text = page.extract_text() or ""
                tables_markdown = ""
                for table in page.extract_tables():
                    tables_markdown += tableToMarkdown(table) + "\n"
                

                # Combine page text and markdown tables
                full_text = page_text + "\n" + tables_markdown if tables_markdown else page_text
                results[f"page_{page_num}"] = full_text.strip()


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
        logger.error(f"Error processing normal files: {e}")
    return {},''

def processNonScannedFile(filePathInput, outputPath):
    """
    Process a PDF file interactively by prompting the user for file path only.
    Output is always in JSON format.
    """
    try:
        logger.info(f"Processing {os.path.basename(filePathInput)} to JSON format...")
        result,outputFileName = processPdfToJson(filePathInput, outputPath)
        data = {
                'result':result,
                'outputFileName': outputFileName
            }
        if result:
            logger.info(f"Text extraction completed for {os.path.basename(filePathInput)}. Output saved to {outputPath}.")
            return getReturnArray(True, f"Text extraction completed for {filePathInput}", data)
        else:
            logger.error(f"Failed to extract text from {os.path.basename(filePathInput)}.")
            return getReturnArray(False, f"Failed to extract text from {os.path.basename(filePathInput)}", None)
    except Exception as e:
        logger.error(f"An error occurred while processing the file: {e}")
    return getReturnArray(False, f"An error occurred while processing the file: {e}", None)