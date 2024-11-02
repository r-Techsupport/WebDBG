import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import winston from 'winston';
import cors from 'cors';

// Define __filename and __dirname using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

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
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

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
    logger.info(`Incoming request: ${req.method} ${req.url}`, { body: req.body });
    next();
});

// Function to analyze the file using a command-line debugger
const analyzeFile = (filePath, res) => {
    logger.info(`Analyzing file: ${filePath}`);
    exec(`cdb.exe -z ${filePath} -c "k; !analyze -v; q"`, (error, stdout, stderr) => {
        // Delete the file after processing
        fs.unlink(filePath, (err) => {
            if (err) {
                logger.error(`Failed to delete file: ${err.message}`);
            } else {
                logger.info(`Deleted file: ${filePath}`);
            }
        });

        if (error) {
            logger.error(`Error analyzing file: ${error.message}`);
            res.status(500).send(`An error occurred while analyzing the file`);
            return;
        }
        if (stderr) {
            logger.error(`Stderr: ${stderr}`);
            res.status(500).send(`An error occurred while analyzing the file`);
            return;
        }
        logger.info('Analysis output sent to client');
        res.send(`Output: ${stdout}`);
    });
};

// PUT and POST endpoint to receive .dmp file or URL and analyze it
const handleAnalyzeDmp = async (req, res) => {
    if (req.file) {
        // If a file is uploaded
        const filePath = path.join(uploadsDir, req.file.originalname);
        logger.info(`File uploaded: ${filePath}`);
        analyzeFile(filePath, res);
    } else if (req.body.url) {
        // If a URL is provided
        const encodedUrl = req.body.url;
        const url = decodeURIComponent(encodedUrl); // Decode the URL
        const fileName = path.basename(url);
        const filePath = path.join(uploadsDir, fileName);

        try {
            logger.info(`Fetching file from URL: ${url}`);
            const response = await axios({
                method: 'get',
                url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                logger.info(`File downloaded: ${filePath}`);
                analyzeFile(filePath, res);
            });

            writer.on('error', (err) => {
                logger.error(`Error downloading file: ${err.message}`);
                res.status(500).send(`Error downloading file: ${err.message}`);
            });
        } catch (error) {
            logger.error(`Error fetching URL: ${error.message}`);
            res.status(500).send(`Error fetching URL: ${error.message}`);
        }
    } else {
        logger.warn('No file or URL provided');
        res.status(400).send('No file or URL provided');
    }
};

app.put('/analyze-dmp', upload.single('dmpFile'), handleAnalyzeDmp);
app.post('/analyze-dmp', upload.single('dmpFile'), handleAnalyzeDmp);

// GET endpoint to render README.md as HTML
app.get('/', (req, res) => {
    const readmePath = path.join(__dirname, 'USAGE.md');
    fs.readFile(readmePath, 'utf8', (err, data) => {
        if (err) {
            logger.error(`Error reading README file: ${err.message}`);
            res.status(500).send(`Error reading README file: ${err.message}`);
            return;
        }
        const htmlContent = marked(data, { mangle: false, headerIds: false });
        res.send(htmlContent);
    });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.stack}`);
    res.status(500).send('Something broke, I lost my 418');
});

// Start the server
app.listen(port, () => {
    logger.info(`App listening at http://localhost:${port}`);
});
