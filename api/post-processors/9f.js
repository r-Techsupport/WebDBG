// Generate command for bugcheck 9f (PAGE_FAULT_IN_NONPAGED_AREA / example)
export default (parser, dmp, args = []) => {
    const devstackArg = args[1] ? args[1] : '';
    return `${parser} -z ${dmp} -c "k; !devstack ${devstackArg} ; q"`;
};