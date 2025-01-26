import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import winston from 'winston';
import postProcessResults from './post-process.js'; // Corrected import path

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

// Run the debugger over the dmp file and report errors should failure occur
const processDmpObject = (dmp) => {
    return new Promise((resolve) => {
        logger.info(`Analysis started on ${dmp}`)
        const parser = 'cdb.exe';
        const command = `-z ${dmp} -c "k; !analyze -v ; q"`;

        exec(`${parser} ${command}`, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Error during analysis: ${error.message}`);
                return;
            }
            if (stderr) {
                logger.warn(`Warnings during analysis: ${stderr}`);
            }
            resolve(stdout);
        });
    });
};

// Split the raw content provided by processDmpObject
const processResult = (dmp, rawContent) => {
    // Splitting the content
    let splits = rawContent.split('------------------');
    splits = splits.flatMap(split => split.split('STACK_TEXT:'));

    // Post-Processing
    if (splits.length !== 2 && splits.length !== 3) {
        throw new Error("Abnormal file cannot be post-processed");
    }

    // Pulling dmp info
    const infos = splits[0].split('Bugcheck Analysis');
    const dirtyDmpInfo0 = infos[0].split("Copyright (c) Microsoft Corporation. All rights reserved.");
    const dirtyDmpInfo1 = dirtyDmpInfo0[1].split("Loading Kernel Symbols");
    const dmpInfo = dirtyDmpInfo1[0].trim();

    // Pulling Bugcheck Analysis
    const analysisLines = infos[1].split('\n').filter(line => !line.includes('*') && !line.includes("Debugging Details:"));
    const analysis = analysisLines.join('\n').trim();

    // Extracting bugcheck and arguments
    const bugcheckMatch = analysis.match(/\(([^)]+)\)/);
    const bugcheck = bugcheckMatch ? bugcheckMatch[1] : null;

    const argMatches = analysis.match(/Arg\d: ([0-9a-fA-Fx]+)/g);
    const args = argMatches ? argMatches.map(arg => arg.split(': ')[1]) : [];
    logger.info(`Bugcheck: ${bugcheck}`)
    logger.info(`Args: ${args}`)

    // Output object creation
    const output = {
        dmp: dmp, // Include the dmp file path
        dmpInfo: dmpInfo,
        analysis: analysis,
        bugcheck: bugcheck,
        args: args,
        rawContent: rawContent
    };

    return output;
};

// Execute the analysis and processing over the single dmp or a directory of dmps
const Analyze = async (target) => {
    const dmpArray = [];
    const statPath = fs.statSync(target);

    if (!statPath.isDirectory()) {
        const dmp = path.resolve(target);
        const result = await processDmpObject(dmp);
        const processedResult = processResult(dmp, result);
        dmpArray.push(processedResult);
    } else { // Run a job for every dmp file found, this drastically reduces processing time
        const files = fs.readdirSync(target).filter(file => file.endsWith('.dmp'));
        const promises = files.map(async (file) => {
            const dmp = path.resolve(target, file);
            const result = await processDmpObject(dmp);
            return processResult(dmp, result);
        });
        const results = await Promise.all(promises);
        dmpArray.push(...results);
    }

    // Call the postProcessResults function
    const postProcessedResults = await postProcessResults(dmpArray);

    return JSON.stringify(postProcessedResults);
};

export default Analyze;