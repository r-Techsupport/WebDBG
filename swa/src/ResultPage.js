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

const renderJsonToHtml = (data) => {
    if (Array.isArray(data)) {
        return data.map((item) => {
            // Use a stable key: item.key if available, otherwise stringified item
            const key = (item && typeof item === 'object' && item.key) ? item.key : JSON.stringify(item);
            return (
                <div className="content" key={key}>
                    {renderJsonToHtml(item)}
                </div>
            );
        });
    }
    const order = ["dmpName", "dmpInfo", "analysis", "post", "rawContent"];
    const specialKeys = ["rawContent"];
    const sortedData = sortJson(data, order);
    const keyValueArray = Object.entries(sortedData).map(([key, value]) => ({ key, value }));
    const specialItems = keyValueArray.filter(item => specialKeys.includes(item.key));
    const regularItems = keyValueArray.filter(item => !specialKeys.includes(item.key));
    const regularRender = regularItems.map((item) => (
        <React.Fragment key={item.key}>
            <h2 className={`${item.key} result-header`}>{item.key}</h2>
            <div className="result-content">{item.value}</div>
        </React.Fragment>
    ));
    const specialRender = specialItems.map((item) => (
        <div key={item.key || item.value || Math.random()} className={item.key}>
            <details>
                <summary>Raw results</summary>
                <div className="result-content">{item.value}</div>
            </details>
        </div>
    ));
    return (
        <>
            {regularRender}
            {specialRender}
        </>
    );
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
                    ? <>{renderJsonToHtml(JSON.parse(responseData))}</>
                    : <div className="content"><p style={{ color: '#bf616a' }}>Error: Invalid JSON received from backend.</p></div>
            )}
            </div>
        </div>
    );
};

export default ResultPage;
