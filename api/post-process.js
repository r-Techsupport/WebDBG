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
    '9f': (parser, dmp, args) => `${parser} -z ${dmp} -c "k; !devstack ${args[1]} ; q"`,
    // Add more bugcheck commands here as needed
    // '<bugcheck>': (dmp, args) => `cdb.exe -z ${dmp} -c "k; <commands to run> ; q"`,
    // Args can be used in a command ${args[#]}
    // Arg counts start at 0 so "Arg1" is ${args[0]}
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
const postProcessResults = async (results, parser) => {
    for (const result of results) {
        const commandGenerator = bugcheckCommands[result.bugcheck];
        if (commandGenerator) {
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
            result.post = null; // Add a null post key if no command is run
            logger.info(`No command for bugcheck: ${result.bugcheck}`);
        }
    }

    return results;
};

export default postProcessResults;