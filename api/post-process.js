import { exec } from 'child_process';
import winston from 'winston';

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

// Configuration object for bugcheck commands
const bugcheckCommands = {
    '9f': (args) => `!devstack ${args[1]}`,
    '7E': (args) => `!devstack ${args[0]}`
    // Add more bugcheck commands here as needed
};

// Function to execute a command and return a promise
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${error.message}`);
            } else if (stderr) {
                resolve(`Warnings: ${stderr}`);
            } else {
                resolve(stdout);
            }
        });
    });
};

// Function to perform additional operations on the analysis results
const postProcessResults = async (results) => {
    for (const result of results) {
        const commandGenerator = bugcheckCommands[result.bugcheck];
        if (commandGenerator) {
            const command = commandGenerator(result.args);
            logger.info(`Executing command: ${command}`);
            try {
                const output = await executeCommand(command);
                result.post = output;
                logger.info(`Command output: ${output}`);
            } catch (error) {
                result.post = error;
                logger.error(`Error executing command: ${error}`);
            }
        } else {
            result.post = null; // Add a null post key if no command is run
            logger.info(`No command for bugcheck: ${result.bugcheck}`);
        }
    }

    return results;
};

export default postProcessResults;