import logging

def intializeLogs(logfile_name="./logs.log"):
    """
    Returns a logger instance that logs to both console and a file.
    """
    logger = logging.getLogger(logfile_name)
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    # Avoid duplicate handlers if get_logger is called multiple times
    if not logger.handlers:
        # Console handler
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        # File handler
        file_handler = logging.FileHandler(logfile_name, mode="a", encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger