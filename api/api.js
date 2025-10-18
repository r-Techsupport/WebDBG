import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import winston from 'winston';
import unzipper from 'unzipper';
import { fileTypeFromBuffer } from 'file-type';
import { readChunkSync } from 'read-chunk';
import { v4 as uuidv4 } from 'uuid'
import Analyze from './analyze.js';

// Define __filename and __dirname using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = process.env.PORT || 3000;
app.set('trust proxy', true);

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uploadName = uuidv4().split('-')[0]; // Generate a unique upload name
        req.uploadName = uploadName; // Store the upload name in the request object
        cb(null, uploadName);
    }
});

// Set CORS headers for all requests when ENABLE_CORS is set
if (process.env.ENABLE_CORS === 'true') {
    logger.info('CORS is enabled for all origins');
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');
        next();
    });
}

// Size limit of 10M
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Add security headers to all responses
app.use(helmet()); // Add security headers to all responses

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 10 // limit each IP to 10 requests per windowMs
});
app.use(limiter);

// Middleware to log incoming requests
app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.ip} ${req.method} ${req.url}`, { body: req.body });
    next();
});

// Function to delete our file after processing or an error
const deleteFile = async (deletePath) => {
    try {
        await fs.promises.rm(deletePath, { recursive: true, force: true });
        logger.info(`Deleted target: ${deletePath}`);
    } catch (err) {
        logger.error(`Failed to delete target: ${err.message}`);
    }
};

// Function to check the first 4 bytes of a file
// If they are PAGE then it is a valid DMP
const checkFileHeader = (checkPath) => {
    const buffer = readChunkSync(checkPath, { length: 4, startPosition: 0 });
    const fileHead = Array.from(buffer).map(byte => String.fromCharCode(byte)).join('');
    if (fileHead !== 'PAGE') {
        logger.warn(`Unsupported file header: ${fileHead}`);
        return false;
    }
    logger.info('File is a DMP with PAGE header');
    return true;
};

// Function to execute analysis commands on local files
const analyzeFile = async (filePath, res) => {
    logger.info(`Sending target: ${filePath} for analysis`);

    try {
        const analysisResult = await Analyze(filePath);
        logger.info('Analysis output sent to client');
        res.json(JSON.parse(analysisResult));
    } catch (error) {
        logger.error(`Failed to analyze target: ${error.message}`);
        res.status(500).send("An error occurred while analyzing the file");
    } finally {
        await deleteFile(filePath);
    }
};

// PUT and POST endpoint to receive .dmp file or URL and analyze it
const handleAnalyzeDmp = async (req, res) => {
    const uploadName = req.uploadName || uuidv4().split('-')[0]; // Retrieve the upload name from the request object
    const uploadPath = path.join(uploadsDir, `${uploadName}`);

    if (req.file) { // If a file is uploaded
        logger.info(`File uploaded: ${uploadPath}`);

    } else if (req.query.url) { // If a URL is provided
        const encodedUrl = req.query.url;
        const url = decodeURIComponent(encodedUrl); // Decode the URL

        try {
            logger.info(`Fetching file from URL: ${url}`);
            const response = await axios({
                method: 'get',
                url,
                responseType: 'stream'
            });

            logger.info(`Writing file to: ${uploadPath}`)
            const writer = fs.createWriteStream(uploadPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    logger.info(`File downloaded: ${uploadPath}`);
                    resolve();
                });
                writer.on('error', (err) => {
                    logger.error(`Failed to download file: ${err.message}`);
                    res.status(500).send(`An error occured while downloading file: ${err.message}`);
                    reject(err);
                });
            });

        } catch (error) {
            logger.error(`Failed to fetch URL: ${error.message}`);
            res.status(500).send(`An error occured while fetching URL: ${error.message}`);
            return; // Terminate on invalid URL
        }
    } else {
        logger.warn('No file or URL provided');
        res.status(400).send('No file or URL provided');
    }

    // Process the files
    const buffer = fs.readFileSync(uploadPath);
    const mimeTypeObj = await fileTypeFromBuffer(buffer);

    // If mimeTypeObj returns a valid response check that it is a zip
    // otherwise it is not valid and we reject it
    if (mimeTypeObj) { 
        logger.info(`File type is: ${mimeTypeObj.mime}`)

        if (mimeTypeObj.mime === 'application/zip') {
            logger.info(`.zip file uploaded`)

            const filePath = `${uploadPath}_dir`
            fs.createReadStream(uploadPath)
            .pipe(unzipper.Extract({ path: filePath }))
            .on('close', () => {
                logger.info(`.zip file extracted: ${filePath}`);
                deleteFile(uploadPath); // Delete zip file

                // Check for subdirectories and for more than 10 files in a zip
                // If the checks fail delete the extracted directory
                // it then checks the contained files for their headers, fail entirely on any single file
                // Finally  analyze the directory
                fs.readdir(filePath, { withFileTypes: true }, (err, files) => {
                    if (err) {
                        logger.error(`Failed to read extracted directory: ${err.message}`);
                        res.status(500).send(`An error occurred while reading the extracted directory: ${err.message}`);
                        deleteFile(filePath);
                        return;
                    }

                    // Log files contained in the archive
                    logger.info('Files in the archive:');
                    files.forEach(file => {
                        logger.info(`    - ${file.name} ${file.isDirectory() ? '(directory)' : '(file)'}`);
                    });

                    const hasSubdirectories = files.some(file => file.isDirectory()); 
                    const hasMinidumpSubdirectory = files.some(file => file.isDirectory() && file.name === 'Minidump');

                    // If there is a Minidumps subdirectory adjust our variable then analyze
                    // We assume there are no invalid files in a Minidumps directory
                    // Testing shows the API won't choke on invalid files so meh
                    if (hasMinidumpSubdirectory) {
                        logger.info('Archive contains Minidumps directory');
                        const filePath0 = `${filePath}\\Minidump`;

                        // List files in filePath0
                        const filesInMinidump = fs.readdirSync(filePath0);
                        logger.info('Files in the Minidump directory:');
                        filesInMinidump.forEach(file => {
                            const miniPath = path.join(filePath0, file);
                            const isDirectory = fs.statSync(miniPath).isDirectory();
                            logger.info(`    - ${file} ${isDirectory ? '(directory)' : '(file)'}`);
                        });

                        analyzeFile(filePath0, res);

                    // if there are subdirectories that are not Minidump return 400
                    } else if (hasSubdirectories) {
                        logger.warn('Archive contains invalid subdirectories');
                        res.status(400).send('Uploaded archive contains invalid subdirectories. .dmps must be loose files inside the single archive or in a Minidump directory');
                        deleteFile(filePath);

                    // If more than 10 files in an archive return 400
                    } else if (files.length > 10) {
                        logger.warn('Archive contains more than 10 files');
                        res.status(400).send('Uploaded archive contains more than 10 files');
                        deleteFile(filePath);
                    
                    // If no subdirectories validate the files then analyze
                    } else {
                        const validFiles = files.filter(file => checkFileHeader(path.join(filePath, file.name)));
                        if (validFiles.length > 0) {
                            analyzeFile(filePath, res);
                        } else {
                            logger.warn('Archive only contains unsupported file types');
                            res.status(400).send('Uploaded archive only contains unsupported file types');
                            deleteFile(filePath);
                        }
                    }
                });

            })
            .on('error', (err) => {
                logger.error(`Failed to extract .zip file: ${err.message}`);
                res.status(500).send(`An error occured while extracting .zip file: ${err.message}`);
                deleteFile(uploadPath);
            });
        } else {
            logger.warn('Unsupported file type');
            res.status(400).send('Unsupported file type');
            await deleteFile(uploadPath);
        }

    // If mimetype is undefined use the checkFileHeader function
    // to check  first 4 bytes of the file, otherwise reject the file
    } else {
        if (checkFileHeader(uploadPath)) { 
            const filePath = `${uploadPath}.dmp`;
            try {
                await fs.promises.rename(uploadPath, filePath);
                logger.info(`Renamed file: ${filePath}`);
            } catch (err) {
                logger.error('Failed to rename file:', err);
                res.status(500).send(`An error occurred while renaming file: ${err.message}`);
                await deleteFile(uploadPath);
            }
            analyzeFile(filePath, res);
        } else {
            res.status(400).send('Unsupported file header, file is not a valid .dmp');
            await deleteFile(uploadPath);
        }
    }
};

app.put('/analyze-dmp', upload.single('dmpFile'), handleAnalyzeDmp);
app.post('/analyze-dmp', upload.single('dmpFile'), handleAnalyzeDmp);

// GET endpoint to render README.md as HTML
app.get('/', (req, res) => {
    const readmePath = path.join(__dirname, 'USAGE.md');
    fs.readFile(readmePath, 'utf8', (err, data) => {
        if (err) {
            logger.error(`Failed to read README file: ${err.message}`);
            res.status(500).send(`An error occured while reading README file: ${err.message}`);
            return;
        }
        const htmlContent = marked(data, { mangle: false, headerIds: false });
        res.send(htmlContent);
    });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            logger.warn('File size exceeds the limit of 10MB');
            return res.status(400).send('File size exceeds the limit of 10MB');
        }
    }

    logger.error(`Unhandled failure: ${err.stack}`);
    res.status(500).send('Something broke, error is 500 but it might as well be 418');
});

// Start the Express server
app.listen(port, () => {
    logger.info(`App listening at http://localhost:${port}`);
});
