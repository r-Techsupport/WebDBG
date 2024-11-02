import React, { useEffect } from 'react';

const Footer = () => {
  useEffect(() => {
    const repoUrl = process.env.REACT_APP_REPO_URL;
    document.getElementById('repo_url').href = repoUrl;
  }, []);

  return (
    <footer>
      <p>Find the source for this project <a id="repo_url" href="#">on GitHub</a></p>
    </footer>
  );
};

export default Footer;