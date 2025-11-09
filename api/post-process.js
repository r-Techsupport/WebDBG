import { exec } from 'child_process';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'post-process.log' })
    ]
});

const bugcheckCommands = {};
const processorsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'post-processors');

try {
    const files = fs.readdirSync(processorsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const name = path.basename(file, '.js');
        const filePath = path.join(processorsDir, file);
        try {
            // eslint-disable-next-line no-await-in-loop
            const mod = await import(pathToFileURL(filePath).href);
            bugcheckCommands[name] = mod.default;
            logger.info(`Loaded post-processor: ${name} -> ${filePath}`);
        } catch (err) {
            logger.error(`Failed to load post-processor ${filePath}: ${err.stack || err}`);
        }
    }
} catch (err) {
    logger.error(`Unable to read post-processors directory "${processorsDir}": ${err.stack || err}`);
}

// Function to execute a command and return a promise
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stderr) {
                resolve(`Warnings: ${stderr}`);
            } else {
                resolve(stdout);
            }
        });
    });
};

// Function to perform additional operations on the analysis results
const postProcessResults = async (results, parser) => {
    for (const result of results) {
        const commandGenerator = bugcheckCommands[String(result.bugcheck || '').toLowerCase()];
        if (commandGenerator) {
            // commandGenerator expected signature: (parser, dmp, args) => string
            const command = commandGenerator(parser, result.dmp, result.args);
            logger.info(`Executing command: ${command}`);
            try {
                const output = await executeCommand(command);
                result.post = output;
                logger.info('Post-process completed');
            } catch (error) {
                result.post = error;
                logger.error(`An error occured while post-processing the file: ${error}`);
            }
        } else {
            result.post = "No post processing configured for this bugcheck";
            logger.info(`No command for bugcheck: ${result.bugcheck}`);
        }
    }

    return results;
};

export default postProcessResults;