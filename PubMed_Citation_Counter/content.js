(function () {
  'use strict';

  // Extract PMIDs and attach placeholder badges
  function getArticleNodes() {
    const articles = document.querySelectorAll('article.full-docsum, div.docsum-content');
    const articleData = [];

    articles.forEach((article) => {
      // Locate PMID text from PubMed docsum
      const pmidElement = article.querySelector('.docsum-pmid');
      const pmid = pmidElement ? pmidElement.textContent.trim() : null;

      if (pmid && !article.querySelector('.pubmed-citation-badge')) {
        const titleElement = article.querySelector('.docsum-title') || article.querySelector('a.docsum-title');

        if (titleElement) {
          const badge = document.createElement('span');
          badge.className = 'pubmed-citation-badge loading';
          badge.textContent = 'Citations: ...';
          titleElement.appendChild(badge);

          articleData.push({ pmid, badge });
        }
      }
    });

    return articleData;
  }

  // Fetch and parse XML citation counts from NCBI E-utilities
  async function fetchCitationCounts(pmidList) {
    if (pmidList.length === 0) return {};

    const ids = pmidList.join(',');
    // E-utilities elink uses XML output by default
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pubmed&id=${ids}&linkname=pubmed_pubmed_citedin`;

    try {
      const response = await fetch(url);
      const xmlText = await response.text();

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const citationCounts = {};

      // Initialize all requested PMIDs with 0 citations
      pmidList.forEach((id) => {
        citationCounts[id] = 0;
      });

      const linkSetNodes = xmlDoc.querySelectorAll('LinkSet');

      linkSetNodes.forEach((linkSet) => {
        const idNode = linkSet.querySelector('IdList > Id');
        if (!idNode) return;

        const pmid = idNode.textContent.trim();

        // Search specifically for the 'pubmed_pubmed_citedin' LinkSetDb
        const linkDbNodes = linkSet.querySelectorAll('LinkSetDb');
        linkDbNodes.forEach((linkDb) => {
          const linkNameNode = linkDb.querySelector('LinkName');
          if (linkNameNode && linkNameNode.textContent.trim() === 'pubmed_pubmed_citedin') {
            const links = linkDb.querySelectorAll('Link');
            citationCounts[pmid] = links.length;
          }
        });
      });

      return citationCounts;
    } catch (error) {
      console.error('Error fetching citation data from NCBI:', error);
      return null;
    }
  }

  // Process PubMed DOM nodes
  async function processPubMedResults() {
    const articleData = getArticleNodes();
    if (articleData.length === 0) return;

    const pmids = articleData.map((item) => item.pmid);
    const counts = await fetchCitationCounts(pmids);

    articleData.forEach(({ pmid, badge }) => {
      if (counts && counts[pmid] !== undefined) {
        badge.classList.remove('loading');
        badge.textContent = `Cited by: ${counts[pmid]}`;
      } else {
        badge.classList.remove('loading');
        badge.classList.add('error');
        badge.textContent = 'Cited: N/A';
      }
    });
  }

  // Initial execution on load
  processPubMedResults();

  // Watch for dynamic updates (pagination / infinite scroll)
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      processPubMedResults();
    }
  });

  const targetNode = document.body;
  if (targetNode) {
    observer.observe(targetNode, { childList: true, subtree: true });
  }
})();