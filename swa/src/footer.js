import React, { useEffect } from 'react';

const Footer = () => {
  useEffect(() => {
    const repoUrl = process.env.REACT_APP_REPO_URL;
    document.getElementById('repo_url').href = repoUrl;
  }, []);

  return (
    <footer>
      <p>Find the source for this project <a id="repo_url" href="#">on GitHub</a></p>
      <p style={{fontSize: `.75em`}}><a href="https://www.flaticon.com/free-icons/dmp" title="dmp icons">Dmp icons created by PixelX - Flaticon</a></p>
    </footer>
  );
};

export default Footer;