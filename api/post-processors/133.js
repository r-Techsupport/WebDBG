// Generate command for bugcheck 133 (DPC_WATCHDOG_VIOLATION)
export default (parser, dmp) => {
    return `${parser} -z ${dmp} -c "k; !dpcwatchdog ; q"`;
};