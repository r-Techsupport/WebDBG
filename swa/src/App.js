import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Footer from './footer';

// Retrieve the site name and API URL from environment variables
const SITE_NAME = process.env.REACT_APP_SITE_NAME;
const API_URL = process.env.REACT_APP_API_URL;

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

      const data = await response.json();
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

      const data = await response.json();
      setResponseData(data);
    } catch (error) {
      console.error('Error submitting URL:', error);
      setError('Error submitting URL');
    } finally {
      setLoading(false);
    }
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
        <div>
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleFileUpload} disabled={loading}>
            {loading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
        <div>
          <input type="text" value={url} onChange={handleUrlChange} placeholder="Enter URL" />
          <button onClick={handleUrlSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit URL'}
          </button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {responseData && (
          <div id="content">
            <h2>Response Data:</h2>
            <pre>{JSON.stringify(responseData, null, 2)}</pre>
          </div>
        )}
        <Footer />
      </div>
    </div>
  );
};

export default FileUpload;
