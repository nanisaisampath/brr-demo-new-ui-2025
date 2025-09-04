import shutil
from dotenv import load_dotenv
from src.discoverFiles import classifyFiles, extractIdentificationList, scanDocument
from src.helperFunctions import getReturnArray, checkPath, checkDirectory, writeJSON
from src.logs import intializeLogs
import os
import json

# Initialize logger
logger = intializeLogs()

def initialize():
    try:
        logger.info("Loading environment variables...")
        load_dotenv()
        rootPath = os.getenv('ROOT_PATH', os.getcwd())
        logger.info(f"Root path set to: {rootPath}")

        if rootPath:
            os.chdir(rootPath)
            batchFoldername = os.getenv('BATCH_FOLDER') + '_' + os.getenv('BATCH_LABEL')
            outputFolderName = os.getenv('OUTPUT_PATH')
            extractedTextOutputFolderName = outputFolderName+'/' + os.getenv('EXTRACTED_TEXT_OUTPUT_FOLDER_NAME')
            verificationOutputPath = outputFolderName + '/' + os.getenv('VERIFICATION_OUTPUT_FILE_NAME')
            logger.info(f"Checking batch folder: {batchFoldername}")
            batchFolderDetails = checkPath(batchFoldername)
            logger.info(f"Checking output folder: {outputFolderName}")
            outputFolderDetails = checkDirectory(outputFolderName)
            logger.info(f"Checking extracted text output folder: {extractedTextOutputFolderName}")
            extractedTextOutputDetails = checkDirectory(extractedTextOutputFolderName)
            identificationTermsFile = os.getenv('IDENTIFICATION_TERMS_LIST_FILE')
            identificationTermsOutput = os.getenv('IDENTIFICATION_TERMS_OUTPUT_PATH')
            logger.info(f"Checking identification terms file: {identificationTermsFile}")
            if not checkPath(identificationTermsFile)['status']:
                logger.error("BRR key terms file does not exist")
                return getReturnArray(False, "BRR key terms file does not exist", None)
            if checkPath(identificationTermsOutput)['status']:
                logger.info(f"Removing existing identification terms output file: {identificationTermsOutput}")
                os.remove(identificationTermsOutput)
            if checkPath(verificationOutputPath)['status']:
                logger.info(f"Removing existing verification output file: {verificationOutputPath}")
                os.remove(verificationOutputPath)
            # Extract identification terms list
            logger.info("Extracting identification terms list...")
            inputIndentifactionListPath = identificationTermsFile
            outputIndentifactionJsonPath = identificationTermsOutput
            identificationListData = extractIdentificationList(inputIndentifactionListPath, outputIndentifactionJsonPath)
            if not identificationListData['status']:
                logger.error(f"Failed to extract identification list: {identificationListData['message']}")
                return getReturnArray(False, identificationListData['message'], None)
            if not batchFolderDetails['status']:
                logger.error(f"Batch folder error: {batchFolderDetails['message']}")
                return getReturnArray(False, batchFolderDetails['message'], None)
            if not outputFolderDetails['status']:
                logger.error(f"Output folder error: {outputFolderDetails['message']}")
                return getReturnArray(False, outputFolderDetails['message'], None)
            if not extractedTextOutputDetails['status']:
                logger.error(f"Extracted text output folder error: {extractedTextOutputDetails['message']}")
                return getReturnArray(False, extractedTextOutputDetails['message'], None)

            batchFolder = batchFolderDetails['data'][0]
            outputFolder = outputFolderDetails['data'][0]
            extractedTextOutputFolder = extractedTextOutputDetails['data'][0]
            identificationList = identificationListData['data'][0]
            verificationPathDetails = verificationOutputPath
            configDataDetails = {
                "batchFolder": batchFolder,
                "identificationTermsList": identificationList,
                "identificationTermsOutputPath": outputIndentifactionJsonPath,
                "outputPath": outputFolder,
                "extractedTextPath": extractedTextOutputFolder,
                "verificationOutputPath": verificationPathDetails
            }
            return getReturnArray(True, "Initialization of config files and folders is completed", configDataDetails)
    except Exception as e:
        logger.exception("Failed to initialize root path")
        return getReturnArray(False, f"Failed to initialize root path: {e}", None)


def generateVerification(batchFolder, identificationList, outputFilePath):
    """
    Extract text from files in the specified batch folder.
    ARGS
        batchFolder (string): Path to the batch folder containing files.
    RETURN
        Return returnArray -> data: list of file details with extracted text.
    """
    try:
        logger.info(f"Loading environment variables for text extraction...")
        load_dotenv()
        if not os.path.exists(batchFolder):
            logger.error(f"Batch folder does not exist: {batchFolder}")
            return getReturnArray(False, "Batch folder does not exist", None)

        # Classify files in the batch folder
        logger.info(f"Classifying files in batch folder: {batchFolder}")
        classifiedFiles = classifyFiles(batchFolder)
        if classifiedFiles['status'] is False:
            logger.error(f"File classification failed: {classifiedFiles['message']}")
            return getReturnArray(False, classifiedFiles['message'], None)

        files = classifiedFiles['data'][0]
        finalSearchedFiles = []
        dataMontage = {}
        logger.info(f"Found {len(files['scannedFiles'])} scanned files and {len(files['normalFiles'])} normal files.")
        for file in files['scannedFiles']:
            logger.info(f"Processing scanned file: {file}")
            scannedSearchResults = scanDocument(file, 'scanned', identificationList,outputFilePath)
            if scannedSearchResults['status']:
                finalSearchedFiles.append(scannedSearchResults['data'][0])

        for file in files['normalFiles']:
            logger.info(f"Processing normal file: {file}")
            nonScannedSearchResults = scanDocument(file, 'normal', identificationList,outputFilePath)
            if nonScannedSearchResults['status']:
                finalSearchedFiles.append(nonScannedSearchResults['data'][0])
        dataMontage['batchDocs'] = finalSearchedFiles

        logger.info(finalSearchedFiles)
        logger.info("Text verification completed")
        return getReturnArray(True, "Text verification completed", dataMontage)
    except Exception as e:
        logger.exception("Failed to verify text")
        return getReturnArray(False, f"Failed to verify text: {e}", None)

def main():
    logger.info("Starting main process...")
    initialization = initialize()
    
    if initialization['status']:
        batchFolder = initialization['data'][0]['batchFolder']
        extractedTextOutputFolder = initialization['data'][0]['extractedTextPath']
        identificationList = initialization['data'][0]['identificationTermsList']
        identificationListOutputPath = initialization['data'][0]['identificationTermsOutputPath']
        verificationOutputPath = initialization['data'][0]['verificationOutputPath']
        result = generateVerification(batchFolder, identificationList, extractedTextOutputFolder)
        if result['status'] and result['data'][0]:
            logger.info(f"Verification output saved to: {verificationOutputPath}")
            writeResult = writeJSON(result['data'], verificationOutputPath)
            if not writeResult['status']:
                logger.error(f"Failed to write verification output: {writeResult['message']}")
        logger.info(f"Main process result: {result['message']}")

        if checkPath(identificationListOutputPath)['status']:
            os.remove(identificationListOutputPath)
        else:
            logger.warning("Identification terms output path does not exist, skipping removal.")
        return getReturnArray(result['status'], result['message'], result['data'][0])
    
    logger.error(f"Initialization failed: {initialization['message']}")
    return getReturnArray(initialization['status'], initialization['message'], None)

if __name__ == "__main__":
    logger.info("BRR process started")
    result = main()
    logger.info(f"Script finished with status: {result['status']}, message: {result['message']}")
    if not result['status']:
        logger.error(f"Error: {result['message']}")
    else:
        logger.info("BRR process completed successfully.")