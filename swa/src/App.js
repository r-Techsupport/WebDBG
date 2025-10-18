import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import ResultPage from './ResultPage';
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
    const navigate = useNavigate();
    
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
            if (response.status === 413) {
                setError('Error: File too large. The maximum allowed size is 10MB.');
                return;
            }
            const responseJson = await response.json();
            if (!response.ok) {
                throw new Error(responseJson?.error || 'Upload failed');
            }
            if (responseJson.uuid) {
                navigate(`/${responseJson.uuid}`);
            } else {
                setError('No UUID returned from API');
            }
        } catch (error) {
            console.error(error);
            setError(`Error: ${error.message}`);
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
            if (response.status === 413) {
                setError('Error: File too large. The maximum allowed size is 10MB.');
                return;
            }
            const responseJson = await response.json();
            if (!response.ok) {
                throw new Error(responseJson?.error || 'Upload failed');
            }
            if (responseJson.uuid) {
                navigate(`/${responseJson.uuid}`);
            } else {
                setError('No UUID returned from API');
            }
        } catch (error) {
            console.error(error);
            setError(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    // Removed unused isValidJson
    
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
        console.log("Data received:", data); // Debugging line

        // No clue what this does, but everything is rendered inside it
        if (Array.isArray(data)) {
            return data.map((item, index) => (
                <div className="content">
                    {renderJsonToHtml(item)}
                </div>
            ));
        }

        // Define the key order to display in
        const order = [
            "dmpName",
            "dmpInfo",
            "analysis",
            "post",
            "rawContent",
        ];
        const specialKeys = ["rawContent"];
        const sortedData = sortJson(data, order);
        
        // Convert object to array of key-value pairs
        const keyValueArray = Object.entries(sortedData).map(([key, value]) => ({ key, value }));
        
        // Separate the special items
        const specialItems = keyValueArray.filter(item => specialKeys.includes(item.key));
        const regularItems = keyValueArray.filter(item => !specialKeys.includes(item.key));
        
        // Render the regular items
        const regularRender = regularItems.map((item, index) => (
            <>
            <h2 className={`${item.key} result-header`}>
                {item.key}
            </h2>
            <div className="result-content">
                {item.value}
            </div>
            </>
        ));
        
        // Render the special items with their own method
        const specialRender = specialItems.map((item, index) => (
            <div key={index} className={item.key}>
            <details>
                <summary>Raw results</summary>
                <div className="result-content">{item.value}</div>
            </details>
            </div>
        ));
        
        // Combine both renders
        return (
            <>
            {regularRender}
            {specialRender}
            </>
        );
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
                <div className="button-container">
                    <div className="button-div">
                        <input type="file" accept=".dmp,.zip" onChange={handleFileChange} />
                        <button onClick={handleFileUpload} disabled={loading}>
                            {loading ? 'Uploading...' : 'Upload File'}
                        </button>
                    </div>
                    <div className="button-div">
                        <input type="text" value={url} onChange={handleUrlChange} placeholder="Enter URL" />
                        <button onClick={handleUrlSubmit} disabled={loading}>
                            {loading ? 'Submitting...' : 'Upload URL'}
                        </button>
                    </div>
                </div>
                <div>
                {!error && !responseData && <div className="content"><p>{loading ? 'Processing...' : 'Upload your .dmp file or a .zip file containing multiple .dmp files directly or via a direct link.'}</p></div>}
                {error && <div className="content"><p style={{ color: '#bf616a' }}>{error}</p></div>}
                {responseData && (
                    <>{renderJsonToHtml(JSON.parse(responseData))}</>
                )}
                </div>
            <Footer />
            </div>
        </div>
    );
};

const App = () => (
    <Router>
        <Routes>
            <Route path="/" element={<FileUpload />} />
            <Route path=":uuid" element={<ResultPage />} />
        </Routes>
    </Router>
);

export default App;
