import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Footer from './footer';

// Retrieve the site name and API URL from environment variables
const SITE_NAME = process.env.REACT_APP_SITE_NAME;
const API_URL = `${process.env.REACT_APP_API_URL}/analyze-dmp`;

const FileUpload = () => {
    const [file, setFile] = useState(null);
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [responseData, setResponseData] = useState('');
    
    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };
    
    const handleUrlChange = (e) => {
        setUrl(e.target.value);
    };
    
    const handleFileUpload = async () => {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('dmpFile', file);
        
        setLoading(true);
        setError('');
        setResponseData('');
        
        try {
            const response = await fetch(API_URL, {
                method: 'PUT',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.text();
            setResponseData(data);
        } catch (error) {
            console.error('Error uploading file:', error);
            setError('Error uploading file');
        } finally {
            setLoading(false);
        }
    };
    
    const handleUrlSubmit = async () => {
        if (!url) return;
        
        setLoading(true);
        setError('');
        setResponseData('');
        
        try {
            const response = await fetch(`${API_URL}?url=${encodeURIComponent(url)}`, {
                method: 'PUT',
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.text();
            setResponseData(data);
        } catch (error) {
            console.error('Error submitting URL:', error);
            setError('Error submitting URL');
        } finally {
            setLoading(false);
        }
    };
    
    // Function to validate JSON Response
    const isValidJson = (data) => {
        try {
            JSON.parse(data);
            return true;
        } catch (e) {
            return false;
        }
    };
    
    // Function to sort JSON keys
    const sortJson = (data, order) => {
        return order.reduce((acc, key) => {
            if (data.hasOwnProperty(key)) {
                acc[key] = data[key];
            }
            return acc;
        }, {});
    };
    
    // Function to render JSON object into HTML objects
    const renderJsonToHtml = (data) => {
        if (Array.isArray(data)) {
            return data.map((item, index) => (
                <div key={index} style={{ marginLeft: '20px' }}>
                {renderJsonToHtml(item)}
                </div>
            ));
        } else if (typeof data === 'object' && data !== null) {
            // Define the key order to display in
            const order = [
                "dmpInfo",
                "analysis",
                "rawContent",
                "BUGCHECK_CODE",
                "BUGCHECK_P1",
                "BUGCHECK_P2",
                "BUGCHECK_P3",
                "BUGCHECK_P4",
                "FILE_IN_CAB",
                "BUGCHECK_CODE",
                "BUGCHECK_P1",
                "BUGCHECK_P2",
                "BUGCHECK_P3",
                "BUGCHECK_P4",
                "FILE_IN_CAB",
                "SECURITY_COOKIE",
                "BLACKBOXBSD",
                "BLACKBOXNTFS",
                "BLACKBOXPNP",
                "BLACKBOXWINLOGON",
                "PROCESS_NAME"
            ];
            const specialKeys = ["dmpInfo", "analysis", "rawContent"];
            const sortedData = sortJson(data, order);
            
            // Convert object to array of key-value pairs
            const keyValueArray = Object.entries(sortedData).map(([key, value]) => ({ key, value }));
            
            // Separate the special items
            const specialItems = keyValueArray.filter(item => specialKeys.includes(item.key));
            const regularItems = keyValueArray.filter(item => !specialKeys.includes(item.key));
            
            // Render the regular items
            const regularRender = regularItems.map((item, index) => (
                <>
                <dt>{item.key}</dt>
                <dd>{item.value}</dd>
                </>
            ));
            
            // Render the special items with their own method
            const specialRender = specialItems.map((item, index) => (
                <div key={index} className={item.key}>
                <details>
                    <summary>{item.key}</summary>
                    <pre>{item.value}</pre>
                </details>
                </div>
            ));
            
            // Combine both renders
            return (
                <>
                    <dl>
                        {regularRender}
                    </dl>
                    <div>
                        {specialRender}
                    </div>
                </>
            );
            
        }
        return {data};
    };
    
    
    
    
    return (
        <div>
        <Helmet>
        <title>{SITE_NAME}</title>
        </Helmet>
            <div id="container"> 
                <div id="header">
                <h1 id="site_name">{SITE_NAME}</h1>
                </div>
                <div class="button-container">
                    <div class="button-div">
                    <input type="file" onChange={handleFileChange} />
                    <button onClick={handleFileUpload} disabled={loading}>
                    {loading ? 'Uploading...' : 'Upload File'}
                    </button>
                    </div>
                    <div class="button-div">
                    <input type="text" value={url} onChange={handleUrlChange} placeholder="Enter URL" />
                    <button onClick={handleUrlSubmit} disabled={loading}>
                    {loading ? 'Submitting...' : 'Upload URL'}
                    </button>
                    </div>
                </div>
                
                <div id="content">
                {!error && !responseData && <p>Upload your .dmp file or provide a download link above</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                {responseData && (
                    <>{renderJsonToHtml(JSON.parse(responseData))}</>
                )}
                </div>
            <Footer />
            </div>
        </div>
    );
};

export default FileUpload;
