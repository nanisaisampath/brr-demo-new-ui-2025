
import json
import pandas as pd
import os
import filetype
from dotenv import load_dotenv
from pdfminer.high_level import extract_text
from src.helperFunctions import getReturnArray
from src.scannedFilesExtraction import processScannedFile
from src.nonScannedFilesExtraction import processNonScannedFile
from src.chunkPDFs import findText

def checkFolderAndConfig(folder):
    '''
        Checks if any folder exists and if the DiscoverFilesConfig.json file exists and can be opened.
    ARGS
        folder (string): Path to directory to scan.
    RETURN
        Return returnArray -> data: If successful; loaded json data.
    '''
    # Check if the folder exists
    if not os.path.exists(folder):
        return getReturnArray(False, "No such folder: " + folder, "")
    
    load_dotenv()
    # Try to open the config file and read the config
    try:
        f = open(os.getenv('DISCOVER_CONFIG_FILE_PATH'))
        data = json.load(f)
        f.close()
    except Exception:
        return getReturnArray(False, "Could not read the config file (configDiscoverFiles.json) in the brr directory", None)

    return getReturnArray(True, "", data)


def getFileDetails(fileName, extConfig):
    '''
        Get file details. The function uses 'filetype' library and exceptions are managed using config file
    ARGS:
        fileName (string): Name of the file to scan.
        extConfig (json file): Extension configuration file. Default: 's2iConfig\\s2iDiscoverFilesConfig.json'
    RETURN:
        Return returnArray -> data: File details in dictionary form.
    '''
    # Check if file exists
    if os.path.exists(fileName):
        pass
    else:
        return getReturnArray(False, "No such file - " + fileName, "")

    # Get file details
    data = []
    fileDetails = {
        "size": 0,
        "type": "",
        "format": ""
    }

    # Update the file size in KB
    fileDetails.update({"size": round(os.path.getsize(fileName) / 1000, 2)})

    # Guess the type. If the plugin does not have the type then search in our config file
    try:
        kind = filetype.guess(fileName)
    except Exception:
        kind = None

    if kind is None:
        isFound = False
        ext = fileName.rsplit('.')
        if len(ext) == 1:
            ext = ""
        else:
            ext = ext[len(ext) - 1]
            for i in range (len(extConfig[0]["fileTypes"])):
                if extConfig[0]["fileTypes"][i]['extension'] == ext:
                    fileDetails.update({"type": ext})
                    fileDetails.update({"format": extConfig[0]["fileTypes"][i]["mime"]})
                    isFound = True
                    break
        if not isFound:
            fileDetails.update({"type": ext})
            fileDetails.update({"format": "unknown"})
    else:
        fileDetails.update({"type": kind.extension})
        fileDetails.update({"format": kind.mime})

    data.append(fileDetails)

    return getReturnArray(True, "", data)

def scanDir(dir):
    '''
        Scan the given directory for all files.
    ARGS
        dir (string): Path to directory to scan.
    RETURN
        Return returnArray -> data: File details in dictionary form.
    '''
    try:
        # Validate that the folder exists and we have the config file
        configData = checkFolderAndConfig(dir)

        # Return in case of an error
        if configData["status"] is False:
            return getReturnArray(False, configData["message"], "")

        # Get file details
        data = []
        for file in os.scandir(dir):
            if file.is_dir():
                fileDetails = {
                    "name": file.name,
                    "size": 0,
                    "type": "dir",
                    "format": ""
                }
            else:
                fd = getFileDetails(dir + "/" + file.name, configData["data"])
                fileDetails = {
                    "name": file.name,
                    "size": fd["data"][0]["size"],
                    "type": fd["data"][0]["type"],
                    "format": fd["data"][0]["format"]
                }
            data.append(fileDetails)

        return getReturnArray(True, "", data)
    except Exception as e:
        return getReturnArray(False, f"Failed to scan the directory: {e}", None)
    
def readFiles(batchFolder):
  """
    Scans directory only for PDF files  and adds full path to data.
    ARGS
        dir (string): Path to directory to scan.
    RETURN
        Return returnArray -> data: list of PDF file details (dictionary).
  """
  try:
    load_dotenv()
    files = scanDir(batchFolder)
    if files['status'] is False:
      return getReturnArray(False, files['message'], None)
    data = files['data']
    removeFiles = []
    for idx, item in enumerate(data):
        if item['type'] == 'pdf':
            name = item['name']
            fullPath = batchFolder + '/' + name
            item['fullPath'] = fullPath
        else:
          removeFiles.append(idx)
    data = [data[idx] for idx in range(len(data)) if idx not in removeFiles]

    # Configure montage for final data montage
    montage = getReturnArray(True, '', None)
    montage['data'] = [
        {
            'label': os.getenv('BATCH_LABEL'),  # Add batchLabel set previously
            'montagePath': os.getenv('OUTPUT_PATH'),
            'batch': data,
            }

    ]
  except Exception as e:
    return getReturnArray(False, f"Failed to scan the PDF files in directory: {e}", None)
  return getReturnArray(True, '', montage)


def pdfBatchConfiguration(settings):
    """
      Checks batch configuration from settings.
      ARGS
          settings (list): dictionary conatining configuration details.
      RETURN
          Return returnArray -> data: list of PDF file paths.
    """
    batchCfg = settings[0]['batch']
    # check batch cfg - str or subdict?
    batch = []
    if type(batchCfg) is not list:
        return getReturnArray(False, "Error: 'batch' is not of type list.", None)
    if type(batchCfg[0]) is str:
        batch = batchCfg
    elif type(batchCfg[0]) is dict:
        if 'fullPath' in batchCfg[0].keys():
            for item in batchCfg:
                fp = item['fullPath']
                batch.append(fp)
            return getReturnArray(True, "", batch)
        else:
            return getReturnArray(False, "Error: 'fullPath' not in unit dictionary keys.", None)
    else:
        return getReturnArray(False, "Error: 'batch' is not of compatible type. Compatible types:\n- List of string\n- List of dictionary")
    

def checkVerificationFields(verificationOutputPath):
    """
        Check if the verification output file has the required fields.
        ARGS
            verificationOutputPath (str): Path to the verification output file.
        RETURN
            Return returnArray -> data: List of verification results if valid, else error message.
    """
    try:
        with open(verificationOutputPath, 'r') as f:
            verificationResultList = json.load(f)
        
        if not verificationResultList or not isinstance(verificationResultList, list):
            return getReturnArray(False, "Verification output is empty or not a list", None)

        for result in verificationResultList:
            if not result or not isinstance(result, dict):
                return getReturnArray(False, f"Result is not dict object or empty dictionary")
            elif 'status' not in result or not isinstance(result['status'], bool):
                return getReturnArray(False,  f"status not present or not in boolean format")
            elif 'type' not in result or not isinstance(result['type'],str) or  result['type'].lower() not in ['normal','scanned']:
                return getReturnArray(False,  f"type not present or empty string or not in predefined list")
            elif 'fileName' not in result or not isinstance(result['fileName'], str) or not result['fileName'].strip():
                return getReturnArray(False,  f"fileName not present or empty fileName is given")
            elif 'documentName' not in result:
                return getReturnArray(False,  f"documentName field not present", None)
            elif 'extractedTextJsonPath' not in result:
                return getReturnArray(False,  f"jsonFilePath field not present", None)


        return getReturnArray(True, "Verification output file is valid", verificationResultList)
    except Exception as e:
        return getReturnArray(False, f"Failed to check verification fields: {e}", [])


def classifyFiles(batchFolder):

  """
    Scans directory and classifies PDF files into scanned and normal.
    ARGS
        dir (string): Path to directory to scan.
    RETURN
        Return returnArray -> data (dictionary): Contains list of scanned and normal file paths.
  """

  try:
    load_dotenv()
    scannedFiles = []
    normalFiles = []
    # Get settings from Montage structure
    montage = readFiles(batchFolder)
    if not montage['status']:
      return getReturnArray(False, montage['message'], None)
    settings = montage['data'][0]['data']
    batchConfig = pdfBatchConfiguration(settings)
    if not batchConfig['status']:
      return getReturnArray(False, batchConfig['message'], None)
    pdfBatch = batchConfig['data']
    for file in pdfBatch:
      text = extract_text(file, page_numbers=[0])
      if len(text):
        wordCount = len(text.strip().split())
        if wordCount>=int(os.getenv('COUNT_THRESHOLD')):
          normalFiles.append(file)
        else:
          scannedFiles.append(file)

    data = {
        "scannedFiles": scannedFiles,
        "normalFiles": normalFiles
    }
    return getReturnArray(True, "", data)
  except Exception as e:
    return getReturnArray(False, f'Failed to classify the files in directory: {e}', None)
  



def extractIdentificationList(inputListPath, outputJsonPath):
    try:
        df = pd.read_excel(inputListPath, sheet_name='Document List', engine='openpyxl')
        df = df.iloc[:, 1:]
        columnJson = {col: df[col].dropna().tolist() for col in df.columns}
        with open(outputJsonPath, 'w', encoding='utf-8') as f:
            json.dump(columnJson, f, indent=4)
        return getReturnArray(True, f'Identification list extracted to {outputJsonPath}', columnJson)
    except Exception as e:
        return getReturnArray(False, f"Failed to extract identification list: {e}", None)
    

def scanDocument(fileName, fileType, DocumentTermsMap,outputFilePath):
    """
        Args:
            fileName (str): Name of the file being processed.
            fileType (str): Type of the file --> Normal/Scanned
            DocumentTermsMap (dict): Dictionary mapping document names to lists of search terms.
            outputFilePath (str): Path to store the extracted Json files
        Returns:
            Return returnArray -> data: Dictionary with file name, status, matchedTerms, file type, and document name if found.
    """
    try:
        baseFileName = os.path.basename(fileName)
        # Extracts text from PDF file based on the specific type of the file ans stores JSON output in specified output path
        if fileType=='scanned':
            extractedPageTextMapDetails = processScannedFile(fileName, outputFilePath)
        elif fileType=='normal':
            extractedPageTextMapDetails = processNonScannedFile(fileName, outputFilePath)
        extractedPageTextMap = extractedPageTextMapDetails['data'][0]['result']
        extractedTextOutputFileName = extractedPageTextMapDetails['data'][0]['outputFileName']

        if not extractedPageTextMapDetails['status'] or not extractedPageTextMap:
            return getReturnArray(False, "No extracted text available for {baseFileName} search terms", None)
        if not DocumentTermsMap:
            return getReturnArray(False, "No document terms map provided for search terms", None)
        
        # Flatten all page texts into a single lowercase string
        extractedText = " ".join(
            v if isinstance(v, str) else " ".join(v) for v in extractedPageTextMap.values()
        ).lower()

        result = searchTerms(fileName, baseFileName, fileType, extractedText, DocumentTermsMap, extractedTextOutputFileName)
        if result['status']:
            return getReturnArray(True, f"Scanning of the {fileType} document completed.", result['data'][0])
        else:
            return  getReturnArray(False, f"Error during scanning document terms: {e}", None)

    except Exception as e:
        return getReturnArray(False, f"Error during scanning document terms: {e}", None)


def searchTerms(fullFilePath, baseFileName, fileType, extractedText, termsJson, extractedTextFilePath):
    """
        Match documents with terms using findText function.
        Args:
            baseFile (str): Base name of the PDF file
            fileType (str): type of file --> Scanned/Normal
            extractedText(str): Text extracted from the PDF file
            termsJson (dict): Dictionary mapping document names to lists of search terms.
            minMatches (int): Minimum number of matching terms required to consider a document as found.
        Returns:
            Return returnArray -> data: Dictionary with document name, probability, status, and matched terms.
    """
    try:
        # Iterate through each document and check for matches
        bestDocument = ''
        bestProbablity = 0.0
        bestMatched = []

        for docName, terms in termsJson.items():
            matchedTerms = [t for t in terms if t.lower() in extractedText]
            probability = round(len(matchedTerms) / len(terms),2) if terms else 0.0
            if probability>bestProbablity:
                bestDocument = docName
                bestProbablity = probability
                bestMatched = matchedTerms
                
        data = {
            "classficationStatus": bool(bestDocument),
            "fileName": baseFileName,
            "fileLocation": fullFilePath ,
            "documentType": fileType,
            "documentClass": bestDocument,
            "matchedConfidenceScore": bestProbablity,
            "matchedTerms": bestMatched,
            "extractedTextJsonPath": extractedTextFilePath,
            "watermark": '',
            "percentHandwritten": 0.0,
            "percentTyped": 0.0
            
        }
        return getReturnArray(True, f"Found {len(matchedTerms)} matching terms in {docName}", data)
    except Exception as e:
        return getReturnArray(False, f"Error during document matching: {e}", None)