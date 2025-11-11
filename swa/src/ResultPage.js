import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

// Retrieve the site name and API URL from environment variables
const SITE_NAME = process.env.REACT_APP_SITE_NAME;
const API_URL = `${process.env.REACT_APP_API_URL}`;

const isValidJson = (data) => {
    try {
        JSON.parse(data);
        return true;
    } catch (e) {
        return false;
    }
};

const sortJson = (data, order) => {
    return order.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            acc[key] = data[key];
        }
        return acc;
    }, {});
};

// Map JSON keys to user-friendly labels
const headerLabels = {
    dmpName: 'Dump Name',
    dmpInfo: 'Dump Info',
    analysis: 'Analysis',
    post: 'Post Processing',
    rawContent: 'Raw Content'
};

const renderJsonToHtml = (data) => {
    // Top-level array: make each item its own collapsible details block (main title only)
    if (Array.isArray(data)) {
        return data.map((item, idx) => {
            const key = (item && typeof item === 'object' && (item.key || item.dmpName)) ? (item.key || item.dmpName) : `item-${idx}`;
            const title = (item && item.bugcheckHuman && item.dmpName) ? item.bugcheckHuman + " (" + item.dmpName + ")" : `Item #${idx + 1}`;
            return (
                <details key={key} className="content result-collapsible">
                    <summary className="content-title">{title}</summary>
                    <div className="content-body">
                        {renderJsonToHtml(item)}
                    </div>
                </details>
            );
        });
    }

    // Object: render each key as a static section inside the main collapsible block.
    const order = ["dmpInfo", "analysis", "post", "rawContent"];
    const specialKeys = ["rawContent"];
    const sortedData = sortJson(data, order);
    const keyValueArray = Object.entries(sortedData);

    return (
        <>
            {keyValueArray.map(([key, value]) => {
                const isRaw = specialKeys.includes(key);
                return (
                    <div key={key} className="content-section" style={{ marginBottom: 12 }}>
                        <h2 className="result-header" data-key={key}>{headerLabels[key] || key}</h2>
                        <div className="result-content">
                            {isRaw
                                ? <pre style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</pre>
                                : (value && typeof value === 'object')
                                    ? renderJsonToHtml(value)
                                    : <div className={`result-${key}`}>{String(value)}</div>
                            }
                        </div>
                    </div>
                );
            })}
        </>
    );
};

// Collect human readable bugcheck names from the result object to display a summary
const collectBugchecks = (node, collector = []) => {
    if (Array.isArray(node)) {
        node.forEach(item => collectBugchecks(item, collector));
        return collector;
    }
    if (node && typeof node === 'object') {
        if (Object.prototype.hasOwnProperty.call(node, 'bugcheckHuman')) {
            const human = node.bugcheckHuman;
            if (human != null) {
                const s = String(human).trim();
                if (s) collector.push(s);
            }
        }
        Object.values(node).forEach(v => collectBugchecks(v, collector));
    }
    return collector;
};

const ResultPage = () => {
    const { uuid } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [responseData, setResponseData] = useState('');

    useEffect(() => {
        const fetchResult = async () => {
            setLoading(true);
            setError('');
            setResponseData('');
            try {
                const res = await fetch(`${API_URL}/${uuid}`);
                if (!res.ok) {
                    throw new Error(`Fetch failed: ${res.statusText}`);
                }
                const data = await res.text();
                setResponseData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchResult();
    }, [uuid]);

    return (
        <div>
        <Helmet>
        <title>{SITE_NAME}</title>
        </Helmet>
            <div id="container"> 
                <div id="header">
                    <h1 id="site_name">
                        <a href={'/'} style={{ color: 'inherit', textDecoration: 'none' }}>{SITE_NAME}</a>
                    </h1>
                </div>
            {loading && <div className="content"><p>Loading...</p></div>}
            {error && <div className="content"><p style={{ color: '#bf616a' }}>{error}</p></div>}
            {responseData && (
                isValidJson(responseData)
                    ? (() => {
                        const parsed = JSON.parse(responseData);
                        // If we have multiple results (array with length > 1), build a summary block
                        if (Array.isArray(parsed) && parsed.length > 1) {
                            const all = collectBugchecks(parsed);
                            const counts = all.reduce((acc, name) => {
                                acc[name] = (acc[name] || 0) + 1;
                                return acc;
                            }, {});
                            return (
                                <>
                                    <div className="content summary">
                                        <h2>Summary</h2>
                                        {Object.keys(counts).length === 0 ? (
                                            <p>No bugchecks found.</p>
                                        ) : (
                                            <ul>
                                                {Object.entries(counts).map(([name, cnt]) => (
                                                    <li key={name}>{name} x {cnt}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                        {renderJsonToHtml(parsed)}
                                </>
                            );
                        }
                        // single result or not an array -> normal render
                        return <>{renderJsonToHtml(parsed)}</>;
                    })()
                    : <div className="content"><p style={{ color: '#bf616a' }}>Error: Invalid JSON received from backend.</p></div>
            )}
            </div>
        </div>
    );
};

export default ResultPage;
