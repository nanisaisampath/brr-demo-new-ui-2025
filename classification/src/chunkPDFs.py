'''
This micro service will work across all PDFs. A corresponding config file is required for some of the
methods. The config file describes the layout of the PDF for chunking and extraction.

For 'visualizePDF' method matplotlib version 3.8.3 is required.

Chunking and extraction methods rely on the PDF elements as decsibred by py_pdf_parser library. The
arrays will always contain the index of the element in the PDF. You will need to use the index to get
the actual element using 'getElementsUsingIndex' method.

The following methods are helper functions for this micro-service:

getElementsUsingIndex: Returns the actual element IDs for all PDF elements within the given start & end index
getText: Returns the text of all elements of the PDF within the given start & end elements
getTable: Returns the entire section of the PDF within the start & end elements as a table
getSentences: Returns each row of horizontally aligned elements (table row) as a sentence within the given 
    start & end elements
'''

# Import modules
import json
import datetime
import os
import py_pdf_parser
try:
    from py_pdf_parser.visualise import visualise
    VISUALISE_AVAILABLE = True
except ImportError:
    VISUALISE_AVAILABLE = False
    visualise = None
from py_pdf_parser.loaders import load_file
from py_pdf_parser import tables
from pypdf import PdfReader
from src import helperFunctions


def getElementsUsingIndex(pdfFile, start, end):
    '''
        Get all elements between given start and end indicies. This method is used by other methods of this service.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (int): Ending element.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing startIndex, startElement, endIndex, endElement (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except Exception:
        return helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, '')

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", '')

    # Get the elements block
    try:
        elements = py_pdf_parser.filtering.ElementList(pdfDoc, [start, end])
    except Exception:
        return helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile+ ". It may be corrupted, or a scanned PDF or an image", '')

    data = {
        "startIndex": start,
        "startElement": elements[0],
        "endIndex": end,
        "endElement": elements[len(elements)-1],
    }

    return (helperFunctions.getReturnArray(True, "", data))

def getText(pdfFile, start, end):
    '''
        Get text between two given elements.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (element): Ending element.
    RETURN
        chunkText (string): Extracted text from the pdf between given indices.
    '''
    pdfDoc = load_file(pdfFile)
    # Get elements between the given range
    chunkBlock = pdfDoc.elements.between(start, end)
    # Collect all text from the page
    chunkText = ''
    for e in chunkBlock:
        chunkText = chunkText + e.text() + ' '
    return (chunkText)

def getTable (pdfFile, start, end):
    '''
        Extract table within given elements.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (element): Ending element.
    RETURN
        tabRows (list): Extracted table as a list.
    '''
    pdfDoc = load_file(pdfFile)

    # Start with low tolerance and go up to 50 points with 5 point increments
    tol = 0
    tabElements = []

    # Get text of the page as table. Each row will be considered as one sentence
    while (tol < 50):
        try:
            tabElements = tables.extract_table(pdfDoc.elements.between(start, end), as_text=True, tolerance=tol, fix_element_in_multiple_rows=True, fix_element_in_multiple_cols=True)
            break
        except Exception:
            tol = tol + 5

    tabRows = []
    # Split each row as one sentence
    for t in tabElements:
        tabRows.append(t)

    return tabRows

def getSentences(pdfFile, start, end):
    '''
        Get text between two given elements as sentences.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (element): Ending element.
    RETURN
        sentences (list): Extracted text as sentences from the pdf between given indices.
    '''
    # Get text of the page as table. Each row will be considered as one sentence
    tabElements = getTable(pdfFile, start, end)

    sentences = []
    # Split each row as one sentence
    for t in tabElements:
        strSentence = ""
        for s in t:
            # Remove empty cells
            if (len(s) > 0):
                strSentence = strSentence + s + ' '

        sentences.append(strSentence.strip())

    return (sentences)

#############################################################################
'''
    The following methods do not require a supporting config file:

    visualizePDF: View the PDF layout and its elements in a graphical view. This should be used for analyzing the PDF
    chunkAsText: Returns the entire PDF as a block of text
    chunkAsSentences: Returns the entire PDF split into sentences
    chunkAsTable: Returns the entire PDF as a table
    findText: Returns all occurences of string that matches. The text is matched in the following order - 
        match case -> upper case -> lower case -> title case
    findTextWithinBlock: Returns all occurences of string within a given block of PDF. The text is matched in the
        following order: match case -> upper case -> lower case -> title case
'''
#############################################################################

def visualizePDF(pdfFile):
    '''
        Visualize the PDF to analyze its contents
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        None; loads visual of document within the function.
    '''
    if not VISUALISE_AVAILABLE:
        print("Visualisation not available - ImageMagick not installed")
        return
    
    document = load_file(pdfFile)
    visualise(document)

    return

def chunkAsText(pdfFile):
    '''
        Chunk the PDF as text
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing fileName, dateCreated, chunkSize, chunks. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Get the entire PDF as a block of text
    try:
        textBlock = getText(pdfFile, pdfDoc.elements[0], pdfDoc.elements[len(pdfDoc.elements)-1])
    except:
        return(helperFunctions.getReturnArray(False, "Error reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunkSize": len(textBlock.strip()),
        "chunks": textBlock.strip()
    }

    return (helperFunctions.getReturnArray(True, "", data))

# Get the entire PDF as an array of sentences
def chunkAsSentences(pdfFile):
    '''
        Chunk the PDF as sentences.
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing fileName, dateCreated, totalSentences, chunks. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Get the entire PDF as a block of sentences
    try:
        strSentence = getSentences(pdfFile, pdfDoc.elements[0], pdfDoc.elements[len(pdfDoc.elements)-1])
    except:
        return(helperFunctions.getReturnArray(False, "Error reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    if (len(strSentence) < 1):
        return(helperFunctions.getReturnArray(False, "Unable to parse PDF into sentecnes", ""))
    
    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "totalSentences": len(strSentence),
        "chunks": strSentence
    }

    return (helperFunctions.getReturnArray(True, "", data))

# Chunk the entire PDF as a table
def chunkAsTable(pdfFile):
    '''
        Chunk the PDF as table.
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing fileName, dateCreated, totalSentences, chunks. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Get table
    try:
        tabRows = getTable(pdfFile, pdfDoc.elements[0], pdfDoc.elements[len(pdfDoc.elements)-1])
    except:
        return(helperFunctions.getReturnArray(False, "Error reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    if (len(tabRows) < 1):
        return(helperFunctions.getReturnArray(False, "Unable to parse PDF into a table", ""))

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "totalRows": len(tabRows),
        "chunks": tabRows
    }

    return (helperFunctions.getReturnArray(True, "", data))

def findText (pdfFile, txtString):
    '''
        Find a string / text
    ARGS
        pdfFile (string, path): Path to PDF File.
        txtString (string): Text to locate.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing pdfFile, textString, matchCount, locations. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Check for text as is (matching case)
    tmpElement = pdfDoc.elements.filter_by_text_contains(txtString)

    # Check for text in upper case
    if (len(tmpElement) < 1):
        tmpElement = pdfDoc.elements.filter_by_text_contains(txtString.upper())

    # check with lower case
    if (len(tmpElement) < 1):
        tmpElement = pdfDoc.elements.filter_by_text_contains(txtString.lower())
            
    # Check with title case
    if (len(tmpElement) < 1):
        tmpElement = pdfDoc.elements.filter_by_text_contains(txtString.title())

    data = {
        "pdfFile": pdfFile,
        "textString": txtString,
        "matchCount": len(tmpElement),
        "locations": []
    }

    # Get info about the matching text, if any
    if (len(tmpElement) > 0):
        for e in tmpElement:
            data['locations'].append({"index": e._index,
                                   "pageNum": e.page_number})
        errMsg = ""
    else:
        data['locations'].append({"index": 0,
                                "pageNum": 0})
        errMsg = "Text not found"

    return (helperFunctions.getReturnArray(len(tmpElement) > 0, errMsg, data))

# TODO: Try/except or if/else for edge cases within this function (EC = Edge Case in in line comments below)
def findTextWithinBlock (pdfFile, txtString, start, end):
    '''
        Locate text within a pdf.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (element): Ending element.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing pdfFile, textString, matchCount, locations. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Get the PDF elements within the block
    eBlock = getElementsUsingIndex(pdfFile, start, end) # TODO EC

    # Return in case of an error
    if (eBlock["status"] == False):
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Open the PDF file
    pdfDoc = load_file(pdfFile) # TODO EC

    # Get the chunk between the two elements # TODO EC
    chunkBlock = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])

    # Check for text as is (matching case)
    tmpElement = chunkBlock.filter_by_text_contains(txtString) 

    # Check for text in upper case
    if (len(tmpElement) < 1):
        tmpElement = chunkBlock.filter_by_text_contains(txtString.upper())

    # check with lower case
    if (len(tmpElement) < 1):
        tmpElement = chunkBlock.filter_by_text_contains(txtString.lower())
            
    # Check with title case
    if (len(tmpElement) < 1):
        tmpElement = chunkBlock.filter_by_text_contains(txtString.title())

    data = {
        "pdfFile": pdfFile,
        "textString": txtString,
        "matchCount": len(tmpElement),
        "locations": []
    }
    print(f'len: {len(tmpElement)}')
    # Get info about the matching text, if any
    if (len(tmpElement) > 0):
        for e in tmpElement:
            data['locations'].append({"index": e._index,
                                   "pageNum": e.page_number})
        errMsg = ""
    else:
        data['locations'].append({"index": 0,
                                "pageNum": 0})
        errMsg = "Text not found"

    return (helperFunctions.getReturnArray(len(tmpElement) > 0, errMsg, data))

#####################################################################
''' Find elements that match the given pattern based on regex '''
#####################################################################

def findPattern (pdfFile, rePattern):
    '''
        Find a string / text pattern based on regex
    ARGS
        pdfFile (string, path): Path to PDF File.
        rePattern (string): String pattern to locate.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing pdfFile, textString, matchCount, locations. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Check for string patterns
    tmpElement = pdfDoc.elements.filter_by_regex(rePattern)

    data = {
        "pdfFile": pdfFile,
        "regexPattern": rePattern,
        "matchCount": len(tmpElement),
        "locations": []
    }

    # Get info about the matching text, if any
    if (len(tmpElement) > 0):
        for e in tmpElement:
            data['locations'].append({"index": e._index,
                                   "pageNum": e.page_number,
                                   "content": e.text()})
        errMsg = ""
    else:
        data['locations'].append({"index": 0,
                                "pageNum": 0})
        errMsg = "Pattern not found"

    return (helperFunctions.getReturnArray(len(tmpElement) > 0, errMsg, data))

# TODO: Try/except or if/else for edge cases within this function (EC = Edge Case in in line comments below)
def findPatternWithinBlock (pdfFile, rePattern, start, end):
    '''
        Locate text within a pdf.
    ARGS
        pdfFile (string, path): Path to PDF File.
        rePattern (string): String pattern to locate.
        start (element): Starting element.
        end (element): Ending element.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: Dictionary containing pdfFile, textString, matchCount, locations. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Get the PDF elements within the block
    eBlock = getElementsUsingIndex(pdfFile, start, end) # TODO EC

    # Return in case of an error
    if (eBlock["status"] == False):
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Open the PDF file
    pdfDoc = load_file(pdfFile) # TODO EC

    # Get the chunk between the two elements # TODO EC
    chunkBlock = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])

    # Check for regex pattern
    tmpElement = chunkBlock.filter_by_regex(rePattern)

    data = {
        "pdfFile": pdfFile,
        "regexPattern": rePattern,
        "matchCount": len(tmpElement),
        "locations": []
    }
    print(f'len: {len(tmpElement)}')
    # Get info about the matching text, if any
    if (len(tmpElement) > 0):
        for e in tmpElement:
            data['locations'].append({"index": e._index,
                                   "pageNum": e.page_number,
                                   "content": e.text()})
        errMsg = ""
    else:
        data['locations'].append({"index": 0,
                                "pageNum": 0})
        errMsg = "Pattern not found"

    return (helperFunctions.getReturnArray(len(tmpElement) > 0, errMsg, data))

#####################################################################
'''
    The following methods chunk the PDF by page. The return array groups the text, sentences and table by page
'''
#####################################################################

def chunkByPageAsText(pdfFile):
    '''
        Chunk the PDF by page and get all elements' text
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing fileName, dateCreated, totalPages and chunks.
                    chunks is a dictionary containing: pageNum, chunkSize, and chunkText. (status is True) empty string (status is False)
    '''
     # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Construct the return array
    data = {
            "fileName": pdfFile,
            "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
            "totalPages": len(pdfDoc.page_numbers),
            "chunks": []
    }

    # Chunk ID is row number
    for i in range(len(pdfDoc.page_numbers)):

        # Filter the PDF by page
        page = pdfDoc.elements.filter_by_page(i+1)

        # Get text of the page as a chunk
        chunkBlock = getText(pdfFile, page[0], page[len(page)-1])

        # Add page text as a chunk
        returnDetails = {
            "pageNum": i+1,
            "chunkSize": len(chunkBlock),
            "chunkText": chunkBlock,
        }

        data["chunks"].append(returnDetails)
        
    return (helperFunctions.getReturnArray(True, "", data))

def chunkByPageAsSentences(pdfFile):
    '''
        Get the entire PDF as sentences
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing fileName, dateCreated, totalPages and chunks.
                    chunks is a dictionary containing: pageNum, chunkSize, and chunkText. (status is True) empty string (status is False)
    '''

    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Capture total number of pages
    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "totalPages": len(pdfDoc.page_numbers),
        "chunks": []
    }

    for i in range(len(pdfDoc.page_numbers)):

        # Filter the PDF by page
        page = pdfDoc.elements.filter_by_page(i+1)

        # Get text of the page as sentences
        strSentences = getSentences(pdfFile, page[0], page[len(page)-1])
        chunkSize = len(strSentences)

        if (chunkSize < 1):
            strSentences = "Unable to parse PDF page"

        # Return each row as a chunk
        returnDetails = {
            "pageNum": i+1,
            "chunkSize": chunkSize,
            "chunkText": strSentences,
        }
        data["chunks"].append(returnDetails)

    return (helperFunctions.getReturnArray(True, "", data))

def chunkByPageAsTable(pdfFile):
    '''
        Chunk by page as table
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing fileName, dateCreated, totalPages and chunks.
                    chunks is a dictionary containing: pageNum, chunkSize, and chunkText. (status is True) empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Capture total number of pages
    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "totalPages": len(pdfDoc.page_numbers),
        "chunks": []
    }

    for i in range(len(pdfDoc.page_numbers)):

        # Filter the PDF by page
        page = pdfDoc.elements.filter_by_page(i+1)

        # Get text of the page as table
        pageTable = getTable(pdfFile, page[0], page[len(page)-1])

        chunkSize = len(pageTable)

        if (chunkSize < 1):
            pageTable = "Unable to parse PDF page"

        # Add the table block of the page (list) as a chunk
        returnDetails = {
            "pageNum": i+1,
            "chunkSize": chunkSize,
            "chunkText": pageTable
        }
        data["chunks"].append(returnDetails)

    return (helperFunctions.getReturnArray(True, "", data))

def getImagesAll(pdfFile):
    '''
        Get images from the full PDF
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated, imagesDir, imageCount (status is True) empty string (status is False)
    '''
    # Read the PDF
    reader = PdfReader(pdfFile)

    # Create the images directory if it does not exist
    ra = helperFunctions.unpackFileName(pdfFile)
    fileName = ra['data'][0].rsplit(".")[0]
    dirName = "images_" + fileName

    try:
        os.makedirs(dirName)
    except Exception:
        pass

    # Extract images from all pages
    count = 0
    for page in reader.pages:
        for imageObject in page.images:
            with open(dirName + "/Pg_" + str(reader.get_page_number(page)) + "_img_ " + str(count) + "_" + imageObject.name, "wb") as fp:
                fp.write(imageObject.data)
                count += 1

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "imagesDir": dirName,
        "imageCount": count
    }

    return (helperFunctions.getReturnArray(True, "", data))

def getImagesFromPage(pdfFile, pageNum):
    '''
        Get images from the full PDF from a particular page number.
    ARGS
        pdfFile (string, path): Path to PDF File.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated, imagesDir, imageCount (status is True) empty string (status is False)
    '''
    # Read the PDF
    reader = PdfReader(pdfFile)

    # Create the images directory if it does not exist
    ra = helperFunctions.unpackFileName(pdfFile)
    fileName = ra['data'][0].rsplit(".")[0]
    dirName = "images_" + fileName
    
    try:
        os.makedirs(dirName)
    except Exception:
        pass

    # Extract images from the page
    page = reader.pages[pageNum]
    count = 0

    for image_file_object in page.images:
        with open(dirName + "/Pg_" + str(reader.get_page_number(page)) + "_img_ " + str(count) + "_" + image_file_object.name, "wb") as fp:
            fp.write(image_file_object.data)
            count += 1

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "imagesDir": dirName,
        "imageCount": count
    }

    return helperFunctions.getReturnArray(True, "", data)

#####################################################################
'''
    The following methods chunk the PDF between two indexes. They internally use the private helper method 
    'getElementsUsingIndex' to get the PDF elements that correspond to the indexes.
'''
#####################################################################
##### Get chunk between two Indexes as Text #####
def chunkBetweenIndexAsText(pdfFile, start, end):
    '''
        Get images from the full PDF from a particular page number.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element to begin chunking.
        end (element): Ending element to end chunking.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated, chunkSize, chunkText,
                startPage, endPage, status and errorMessage (status is True) 
                empty string (status is False)
    '''
    # Get the start and end elements
    eBlock = getElementsUsingIndex(pdfFile, start, end)

    # Return in case of an error
    if eBlock["status"] == False:
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Open the PDF file
    pdfDoc = load_file(pdfFile)

    # Get the chunk between the two elements
    chunkText = getText(pdfFile, eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement']).strip()
    chunkBlock = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])

    # Append to array
    if (len(chunkText) > 0):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunkSize": len(chunkText),
        "chunkText": chunkText,
        "startPage": chunkBlock[0].page_number,
        "endPage": chunkBlock[len(chunkBlock)-1].page_number,
        "status": (len(chunkText) > 0),
        "errorMessage": errMsg
    }

    return (helperFunctions.getReturnArray((len(chunkText) > 0), errMsg, data))

def chunkBetweenIndexAsSentences(pdfFile, start, end):
    '''
        Chunk between indexes as sentences.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element to begin chunking.
        end (element): Ending element to end chunking.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing chunkSize, chunkText,
                startPage, endPage, status and errorMessage (status is True) 
                empty string (status is False)
    '''
    # Get the start and end elements
    eBlock = getElementsUsingIndex(pdfFile, start, end)

    # Return in case of an error
    if (eBlock["status"] == False):
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Open the PDF file
    pdfDoc = load_file(pdfFile)

    # Get the chunk between the two elements
    chunkSentences = getSentences(pdfFile, eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])
    chunkBlock = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])

    # Append to array
    if (len(chunkSentences) > 0):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"
    
    data = {
        "chunkSize": len(chunkSentences),
        "chunkText": chunkSentences,
        "startPage": chunkBlock[0].page_number,
        "endPage": chunkBlock[len(chunkBlock)-1].page_number,
        "status": (len(chunkSentences) > 0),
        "errorMessage": errMsg
    }

    return (helperFunctions.getReturnArray((len(chunkSentences) > 0), errMsg, data))

def chunkBetweenIndexAsTable(pdfFile, start, end):
    '''
        Chunk bet as table.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element to begin chunking.
        end (element): Ending element to end chunking.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing chunkSize, chunkText,
                startPage, endPage, status and errorMessage (status is True) 
                empty string (status is False)
    '''
    # Get the start and end elements
    eBlock = getElementsUsingIndex(pdfFile, start, end)

    # Return in case of an error
    if (eBlock["status"] == False):
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Open the PDF file
    pdfDoc = load_file(pdfFile)

    # Get the chunk between the two elements
    chunkTable = getTable(pdfFile, eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])
    chunkBlock = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])

    # Append to array
    if (len(chunkTable) > 0):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"
    
    data = {
        "chunkSize": len(chunkTable),
        "chunkText": chunkTable,
        "startPage": chunkBlock[0].page_number,
        "endPage": chunkBlock[len(chunkBlock)-1].page_number,
        "status": (len(chunkTable) > 0),
        "errorMessage": errMsg
    }

    return (helperFunctions.getReturnArray((len(chunkTable) > 0), errMsg, data))

########################################################################################
'''
    The following methods return the selected page of the PDF as text, sentences or table.
'''
########################################################################################

def chunkPageAsText(pdfFile, pageNum):
    '''
        Chunk a given page as text.
    ARGS
        pdfFile (string, path): Path to PDF File.
        pageNum (int): Page number to extract.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated,
                pageNum, chunkSize, and chunkText (status is True) 
                empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Filter the PDF by page & get the sentences
    try:
        page = pdfDoc.elements.filter_by_page(pageNum)
    except:
        return(helperFunctions.getReturnArray(False, "Page not found or unable to read page", ""))

    # Get page text
    pageText = getText(pdfFile, page[0], page[len(page)-1]).strip()

    if (len(pageText) > 0):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"
    
    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "pageNum": pageNum,
        "chunkSize": len(pageText),
        "chunkText": pageText
    }
        
    return (helperFunctions.getReturnArray((len(pageText) > 0), errMsg, data))

##### Chunk a specified page as sentences
def chunkPageAsSentences(pdfFile, pageNum):
    '''
        Chunk a given page as sentences.
    ARGS
        pdfFile (string, path): Path to PDF File.
        pageNum (int): Page number to extract.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated,
                pageNum, chunkSize, and chunkText (status is True) 
                empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Filter the PDF by page & get the sentences
    try:
        page = pdfDoc.elements.filter_by_page(pageNum)
    except:
        return(helperFunctions.getReturnArray(False, "Page not found or unable to read page", ""))

    # Get page text
    pageSentences = getSentences(pdfFile, page[0], page[len(page)-1])

    if (len(pageSentences) > 0):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "pageNum": pageNum,
        "chunkSize": len(pageSentences),
        "chunkText": pageSentences
    }

    return (helperFunctions.getReturnArray((len(pageSentences) > 0), errMsg, data))

def chunkPageAsTable(pdfFile, pageNum):
    '''
        Chunk a specified page as table.
    ARGS
        pdfFile (string, path): Path to PDF File.
        pageNum (int): Page number to extract.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of chunks containing fileName, dateCreated,
                pageNum, chunkSize, and chunkText (status is True) 
                empty string (status is False)
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Filter the PDF by page
    try:
        page = pdfDoc.elements.filter_by_page(pageNum)
    except:
        return(helperFunctions.getReturnArray(False, "Page not found or unable to read page", ""))

    # Get page text
    pageTable = getTable(pdfFile, page[0], page[len(page)-1])

    if (len(pageTable) > 1):
        errMsg = ''
    else:
        errMsg = "No text found or error in parsing PDF"

    # Add the table block of the page (list) as a chunk
    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "pageNum": pageNum,
        "chunkSize": len(pageTable),
        "chunkText": pageTable
    }

    return (helperFunctions.getReturnArray((len(pageTable) > 0), errMsg, data))

##############################################################################################
'''
    The following methods require a supporting config file that describes the layout of the PDF using text patterns.

    getChunksInfo: Returns the details of each chunk block as per the config file definition
    getChunksAsText, getChunksAsSentences & getChunksAsTable return the chunks as text, sentences or table respectively
'''
##############################################################################################

def getChunksInfo(pdfFile, cfgFile):
    '''
        Get the start and end index information of all chunks as defined in config file. This information is used by most methods of this service.
    ARGS
        pdfFile (string, path): Path to PDF File.
        cfgFile (string, path): Path to Config file (json).
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing the metadata for each chunk as designated by the config file (status is True) empty string (status is False).
    '''
    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        print('e1')
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        print('e2')
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Load the JSON config file
    try:
        f = open(cfgFile)
        data = json.load(f)
        f.close()
    except Exception as e:
        print(e)
        return(helperFunctions.getReturnArray(False, "Error in opening the config file: " + cfgFile, ''))

    # Extract the config in a list
    pdfChunks = data["chunks"]

    # Document sections will be a list of lists
    docSections = []

    # As the text can be in lower, upper or title case; we need to check for all three variations
    for chunk in pdfChunks:
        if len(chunk["startsWith"]) > 1:
            print('G1')
            # Check for text as is (matching case)
            tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0]) and pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][1])

            # Check with upper case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].upper()) and pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][1].upper())

            # Check with lower case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].lower()) and pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][1].lower())

            # Check with title case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].title()) and pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][1].title())

        else:

            #Start with macthing case
            tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0])

            # Check with upper case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].upper())

            # check with lower case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].lower())
            
            # Check with title case
            if (len(tmpElement) < 1):
                tmpElement = pdfDoc.elements.filter_by_text_contains(chunk["startsWith"][0].title())

        # For blocks that may occur more than once
        if (chunk["isMultiple"] == 'True'):
            for te in tmpElement:
                docSections.append([chunk["code"], True, te._index, 0, te, '', '', pdfFile, chunk["name"], te.page_number, 0])
        else:
            if (len(tmpElement) > 1):
                docSections.append([chunk["code"], True, tmpElement[0]._index, 0, tmpElement[0], '', 'WARNING: There may be more than one ' + chunk["name"] + ' sections: ' + str(len(tmpElement)), pdfFile, chunk["name"],tmpElement[0].page_number, 0])
                #print (f"Found {len(tmpElement)} chunks that starts with: {chunk['startsWith']} on page {tmpElement[0].page_number}")
            elif (len(tmpElement) == 1):
                docSections.append([chunk["code"], True, tmpElement[0]._index, 0, tmpElement[0], '', '', pdfFile, chunk["name"], tmpElement[0].page_number, 0])
                #print (f"Found {len(tmpElement)} chunks that starts with: {chunk['startsWith']} on page {tmpElement[0].page_number}")
            else:
                #print (f"Did not find any chunk that starts with: {chunk['startsWith']}")
                if (chunk["isOptional"] == 'False'):
                    docSections.append([chunk["code"], False, -1, -1, '', '', 'ERROR: ' + chunk["name"] + " block is missing", pdfFile, chunk["name"], 0, 0])

    # Sort the sections based on start index value
    docSections.sort(key = lambda x: x[2])

    # Build the final sorted list of all present chunks
    finalSections = []

    # Capture and remove all 'False' chunks
    for i in range(len(docSections)):
        try:
            if (docSections[i][1] == False):
                finalSections.append(docSections[i])
                del docSections[i]
        except Exception:
            pass

    # Capture the first element in first row
    #print (docSections)
    tmpElement = docSections[0]

    '''
        Build the table for document sections. Array elements:
        [0] = Code (See JSON)
        [1] = True (If the chunk is present)
        [2] = Start Index of the chunk
        [3] = End index of the chunk
        [4] = Start element of the chunk
        [5] = End element of the chunk
        [6] = Error message, if any (related to entire chunk)
        [7] = PDF file name
        [8] = Chunk name
        [9] = Start page
        [10] = End page
    '''
    
    for i in range(len(docSections)):
        if (tmpElement[0] == docSections[i][0]):
            pass
        else:
            if (tmpElement[1] == True):
                #print([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][4].page_number])
                finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][4].page_number])
            else:
                #print([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][10]])
                finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][10]])
            tmpElement = docSections[i]

    # Add last row
    allElements = pdfDoc.elements
    finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], allElements[len(allElements)-1]._index, tmpElement[4], allElements[len(allElements)-1], docSections[i][6], docSections[i][7], docSections[i][8], docSections[i][9], allElements[len(allElements)-1].page_number])
    #print ([tmpElement[0], tmpElement[1], tmpElement[2], allElements[len(allElements)-1]._index, tmpElement[4], allElements[len(allElements)-1], docSections[i][6], docSections[i][7], docSections[i][8], docSections[i][9], allElements[len(allElements)-1].page_number])

    data = {
        "fileName": pdfFile,
        "configFileName": cfgFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunks": []
    }
    
    # Construct the final array in JSON format
    for row in finalSections:
        #print (row)
        chunkDetails = {
            "chunkID": len(data["chunks"]),
            "chunkCode": row[0],
            "chunkName": row[8],
            "isFound": row[1],
            "startIndex": row[2],
            "endIndex": row[3],
            "errorMessage": row[6],
            "startPage": row[9],
            "endPage": row[10]
        }

        data["chunks"].append(chunkDetails)

    return helperFunctions.getReturnArray(True, "", data)

def getChunksAsText(pdfFile, cfgFile):
    '''
        Method to extract chunks as text using the config file for chunk blocks.
    ARGS
        pdfFile (string, path): Path to PDF File.
        cfgFile (string, path): Path to Config file (json).
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing the metadata for each chunk as designated by the config file (status is True) empty string (status is False).
    '''
    # Get file chunks
    pdfChunks = getChunksInfo(pdfFile, cfgFile)
    if (pdfChunks["status"] == False):
        return (pdfChunks)

    data = {
        "fileName": pdfFile,
        "configFileName": cfgFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunks": []
    }

    for chunk in pdfChunks["data"][0]["chunks"]:
        # Initialize chunk text
        chunkText = ""

        # Get text of all elements for the chunk
        if (chunk["isFound"] == True):
            # Get start and end elements of the chunk
            eleBlock = getElementsUsingIndex(pdfFile, chunk["startIndex"], chunk["endIndex"])
            chunkText = getText(pdfFile, eleBlock['data'][0]['startElement'], eleBlock['data'][0]['endElement']).strip()

        # Append to array
        chunkText = chunkText.strip()
        if (len(chunkText) > 0):
            errMsg = ''
        else:
            errMsg = "No text found"

        returnDetails = {
            "chunkID": chunk["chunkID"],
            "chunkCode": chunk["chunkCode"],
            "chunkName": chunk["chunkName"],
            "chunkSize": len(chunkText),
            "chunkText": chunkText,
            "startPage": chunk["startPage"],
            "endPage": chunk["endPage"],
            "status": (len(chunkText) > 0),
            "errorMessage": errMsg
        }

        data["chunks"].append(returnDetails)

    return (helperFunctions.getReturnArray(True, "", data))

def getChunksAsSentences(pdfFile, cfgFile):
    '''
        Method to extract chunks as sentences using the config file for chunk blocks.
    ARGS
        pdfFile (string, path): Path to PDF File.
        cfgFile (string, path): Path to Config file (json).
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing the metadata for each chunk as designated by the config file (status is True) empty string (status is False).
    '''
    errMsg = None
    # Get file chunks
    pdfChunks = getChunksInfo(pdfFile, cfgFile)
    if (pdfChunks["status"] == False):
        return (pdfChunks)

    data = {
        "fileName": pdfFile,
        "configFileName": cfgFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunks": []
    }

    for chunk in pdfChunks["data"][0]["chunks"]:

        # Get text of all elements for the chunk
        if (chunk["isFound"] == True):
            eleBlock = getElementsUsingIndex(pdfFile, chunk["startIndex"], chunk["endIndex"])
            chunkSentences = getSentences(pdfFile, eleBlock['data'][0]['startElement'], eleBlock['data'][0]['endElement'])
        else:
            chunkName = chunk['chunkName']
            errMsg = f'{chunkName} was not found with getChunksInfo().'
            print(errMsg)
            chunkSentences = []            

        # Append to array
        if (len(chunkSentences) > 0):
            errMsg = ''
        elif (len(chunkSentences) == 0) and errMsg is None:
            errMsg = "No text in row"

        returnDetails = {
            "chunkID": chunk["chunkID"],
            "chunkCode": chunk["chunkCode"],
            "chunkName": chunk["chunkName"],
            "chunkSize": len(chunkSentences),
            "chunkText": chunkSentences,
            "startPage": chunk["startPage"],
            "endPage": chunk["endPage"],
            "status": (len(chunkSentences) > 0),
            "errorMessage": errMsg
        }
        data["chunks"].append(returnDetails)

    return helperFunctions.getReturnArray(True, "", data)

##### Method to extract chunks as table #####
def getChunksAsTable(pdfFile, cfgFile):
    '''
        Method to extract chunks as table using the config file for chunk blocks.
    ARGS
        pdfFile (string, path): Path to PDF File.
        cfgFile (string, path): Path to Config file (json).
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing the metadata for each chunk as designated by the config file (status is True) empty string (status is False).
    '''
    # Get file chunks
    pdfChunks = getChunksInfo(pdfFile, cfgFile)
    if pdfChunks["status"] == False:
        return (pdfChunks)

    data = {
        "fileName": pdfFile,
        "configFileName": cfgFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunks": []
    }

    for chunk in pdfChunks["data"][0]["chunks"]:

        # Get text of all elements for the chunk
        if chunk["isFound"] == True:
            eleBlock = getElementsUsingIndex(pdfFile, chunk["startIndex"], chunk["endIndex"])
            chunkTable = getTable(pdfFile, eleBlock['data'][0]['startElement'], eleBlock['data'][0]['endElement'])

        # Append to array
        if len(chunkTable) > 0:
            errMsg = ''
        else:
            errMsg = "No text in row or error parsing PDF"

        returnDetails = {
            "chunkID": chunk["chunkID"],
            "chunkCode": chunk["chunkCode"],
            "chunkName": chunk["chunkName"],
            "chunkSize": len(chunkTable),
            "chunkText": chunkTable,
            "startPage": chunk["startPage"],
            "endPage": chunk["endPage"],
            "status": (len(chunkTable) > 0),
            "errorMessage": errMsg
        }
        data["chunks"].append(returnDetails)

    return (helperFunctions.getReturnArray(True, "", data))

################################################################################################################################
'''
    Methods to chunk a subsection using a set of words. This method works on a subsection of the PDF and not the full PDF
'''
################################################################################################################################

def getChunkInfoByWords(pdfFile, start, end, listOfWords):
    '''
        Method to get chunks info using list of words.
    ARGS
        pdfFile (string, path): Path to PDF File.
        start (element): Starting element.
        end (element): Ending element.
        listOfWords (list of text): List of words.
    RETURN
        returnArray (dictionary): Dictionary containing elements 'status', 'message', and 'data'.
            status: True/False whether the function succeeded or failed
            message: Empty string (status is True) or error message (status is False)
            data: List of dictionaries containing the metadata for each chunk as designated by the chunking by list of words. (status is True) empty string (status is False).
    '''
    # Get the start and end elements
    eBlock = getElementsUsingIndex(pdfFile, start, end)

    # Return in case of an error
    if (eBlock["status"] == False):
        return(helperFunctions.getReturnArray(False, eBlock["message"], ''))

    # Check if we got a list of keywords to chunk by
    if (len(listOfWords) < 1):
        return(helperFunctions.getReturnArray(False, "No list of words provided"))

    # Load the PDF
    try:
        pdfDoc = load_file(pdfFile)
    except:
        return(helperFunctions.getReturnArray(False, "Error in opening the PDF file: " + pdfFile, ''))

    # Check for error
    if (len(pdfDoc.page_numbers) == 0):
        return(helperFunctions.getReturnArray(False, "Error in reading the PDF file: " + pdfFile + ". It may be corrupted, or a scanned PDF or an image", ''))

    # Filter the elements block
    blockElements = pdfDoc.elements.between(eBlock['data'][0]['startElement'], eBlock['data'][0]['endElement'])
    # print(blockElements)
    # Document sections will be a list of lists
    docSections = []

    for chunk in listOfWords:
        tmpElement = blockElements.filter_by_text_contains(chunk)
        # print(tmpElement)
        # print(len(tmpElement))
        # Check for the occurences of the word
        if (len(tmpElement) > 1):
            docSections.append([chunk, True, tmpElement[0]._index, 0, tmpElement[0], '', 'WARNING: There may be more than one ' + chunk + ' sections: ' + str(len(tmpElement)), pdfFile, chunk, tmpElement[0].page_number, 0])
            # print (f"Found {len(tmpElement)} chunks that contains: {chunk} on page {tmpElement[0].page_number}")
        elif (len(tmpElement) == 1):
            docSections.append([chunk, True, tmpElement[0]._index, 0, tmpElement[0], '', '', pdfFile, chunk, tmpElement[0].page_number, 0])
            # print (f"Found {len(tmpElement)} chunks that contains: {chunk} on page {tmpElement[0].page_number}")
        else:
            # print (f"Did not find any chunk that contains: {chunk}")
            docSections.append([chunk, False, -1, -1, '', '', 'ERROR: ' + chunk + " is missing", pdfFile, chunk, 0, 0])

    # Sort the sections based on start index value
    docSections.sort(key = lambda x: x[2])

    # Build the final sorted list of all present chunks
    finalSections = []

    # Capture and remove all 'False' chunks
    for i in range(len(docSections)):
        try:
            if (docSections[i][1] == False):
                finalSections.append(docSections[i])
                del docSections[i]
        except:
            pass

    # Capture the first element in first row
    tmpElement = docSections[0]

    '''
        Build the table for document sections. Array elements:
        [0] = Code (See JSON)
        [1] = True (If the chunk is present)
        [2] = Start Index of the chunk
        [3] = End index of the chunk
        [4] = Start element of the chunk
        [5] = End element of the chunk
        [6] = Error message, if any (related to entire chunk)
        [7] = PDF file name
        [8] = Chunk name
        [9] = Start page
        [10] = End page
    '''

    for i in range(len(docSections)):
        if (tmpElement[0] == docSections[i][0]):
            pass
        else:
            if (tmpElement[1] == True):
                #print([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][4].page_number])
                finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][4].page_number])
            else:
                #print([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][10]])
                finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], docSections[i][2], tmpElement[4], docSections[i][4], docSections[i-1][6], docSections[i-1][7], docSections[i-1][8], docSections[i-1][9], docSections[i][10]])
            tmpElement = docSections[i]

    # print(blockElements)
    # Add last row
    finalSections.append([tmpElement[0], tmpElement[1], tmpElement[2], blockElements[len(blockElements)-1]._index, tmpElement[4], blockElements[len(blockElements)-1], docSections[i][6], docSections[i][7], docSections[i][8], docSections[i][9], blockElements[len(blockElements)-1].page_number])

    data = {
        "fileName": pdfFile,
        "dateCreated": datetime.datetime.now().strftime("%Y-%m-%d"),
        "chunks": []
    }

    # Construct the final array in JSON format
    for row in finalSections:
        #print (row)
        chunkDetails = {
            "chunkID": len(data["chunks"]),
            "chunkCode": row[0],
            "chunkName": row[8],
            "isFound": row[1],
            "startIndex": row[2],
            "endIndex": row[3],
            "errorMessage": row[6],
            "startPage": row[9],
            "endPage": row[10]
        }

        data["chunks"].append(chunkDetails)

    return (helperFunctions.getReturnArray(True, "", data))
