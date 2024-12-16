import fs from 'fs';
import path from 'path';
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
        new winston.transports.File({ filename: 'app.log' })
    ]
});

// Run the debugger over the dmp file and report errors should failure occur
const processDmpObject = (dmp) => {
    return new Promise((resolve, reject) => {
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
const processResult = (rawContent) => {
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
    const analysis = infos[1].split('\n').filter(line => !line.includes('*') && !line.includes("Debugging Details:")).join('\n').trim();

    // Output object creation
    const output = {
        dmpInfo: dmpInfo,
        analysis: analysis,
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
        const processedResult = processResult(result);
        dmpArray.push(processedResult);
    } else {
        const files = fs.readdirSync(target).filter(file => file.endsWith('.dmp'));
        for (const file of files) {
            const dmp = path.resolve(target, file);
            const result = await processDmpObject(dmp);
            const processedResult = processResult(result);
            dmpArray.push(processedResult);
        }
    }

    return JSON.stringify(dmpArray);
};

export default Analyze;