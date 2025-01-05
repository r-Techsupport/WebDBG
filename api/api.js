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
import cors from 'cors';
import unzipper from 'unzipper';
import fileType from 'file-type';
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

// Size limit of 10M
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Add security headers to all responses
app.use(helmet()); // Add security headers to all responses

// Add CORS middleware to allow all origins
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET','POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10 // limit each IP to 10 requests per windowMs
});
app.use(limiter);

// Middleware to log incoming requests
app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.ip} ${req.method} ${req.url}`, { body: req.body });
    next();
});

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
        try {
            await fs.promises.rm(filePath, { recursive: true, force: true });
            logger.info(`Deleted target: ${filePath}`);
        } catch (err) {
            logger.error(`Failed to delete target: ${err.message}`);
        }
    }
};

// PUT and POST endpoint to receive .dmp file or URL and analyze it
const handleAnalyzeDmp = async (req, res) => {
    const uploadName = req.uploadName; // Retrieve the upload name from the request object
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
    const buffer = readChunkSync(uploadPath, { length: fileType.minimumBytes, startPosition: 0 });
    const mimeType = fileType(buffer);

    if (mimeType) { // If mimetype returns a valid response
        logger.info(`File type is: ${mimeType.mime}`)

        if (mimeType.mime === 'application/zip') {
            logger.info(`.zip file uploaded`)

            const filePath = `${uploadPath}_dir`
            fs.createReadStream(uploadPath)
            .pipe(unzipper.Extract({ path: filePath }))
            .on('close', () => {
                logger.info(`.zip file extracted: ${filePath}`);

                fs.readdir(filePath, { withFileTypes: true }, (err, files) => { // Check for subdirectories
                    if (err) {
                        logger.error(`Failed to read directory: ${err.message}`);
                        res.status(500).send(`An error occurred while reading the extracted directory: ${err.message}`);
                        return;
                    }

                    const hasSubdirectories = files.some(file => file.isDirectory());
                    if (hasSubdirectories) {
                        logger.warn('Archive contains subdirectories');
                        res.status(400).send('Uploaded archive contains subdirectories .dmps must be loose files inside the single archive');
                    } else {
                        analyzeFile(filePath, res); // Finally analyze the extracted directory
                    }
                });

            })
            .on('error', (err) => {
                logger.error(`Failed to extract .zip file: ${err.message}`);
                res.status(500).send(`An error occured while extracting .zip file: ${err.message}`);
            });
        } else {
            logger.warn('Unsupported file type');
            res.status(400).send('Unsupported file type');
        }

    } else { // If mimetype is undefined check the first 4 bytes of the file
        const fileHeadBuffer = readChunkSync(uploadPath, { length: 4, startPosition: 0 })
        const fileHead = Array.from(fileHeadBuffer).map(byte => String.fromCharCode(byte)).join('');
        logger.info(`First 4 bytes: ${fileHead}`);
        if (fileHead === 'PAGE') {
            logger.info('File is a DMP in PAGE format');

            const filePath = `${uploadPath}.dmp`;
            try {
                await fs.promises.rename(uploadPath, filePath);
                logger.info(`Renamed file: ${filePath}`);
            } catch (err) {
                logger.error('Failed to rename file:', err);
                res.status(500).send(`An error occurred while renaming file: ${err.message}`);
            }

            analyzeFile(filePath, res)
        } else {
            logger.info(`File type was: ${mimeType}`)
            logger.warn('Unsupported file type');
            res.status(400).send('Unsupported file type');
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
    logger.error(`Unhandled failure: ${err.stack}`);
    res.status(500).send('Something broke, I lost my 418');
});

// Start the Express server
app.listen(port, () => {
    logger.info(`App listening at http://localhost:${port}`);
});
