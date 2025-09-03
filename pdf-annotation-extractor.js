import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Use local worker for Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs';

/**
 * Extract hyperlinks from PDF using pdfjs-dist annotations
 * @param {Buffer|string} pdfInput - PDF file as Buffer or file path
 * @returns {Array} Array of hyperlinks with page numbers
 */
async function extractHyperlinksFromPDF(pdfInput) {
  try {
    console.log('=== PDF ANNOTATION EXTRACTION WITH PDFJS-DIST ===');
    
    // Load PDF document
    const pdfBytes = typeof pdfInput === 'string' ? fs.readFileSync(pdfInput) : pdfInput;
    // Convert Buffer to Uint8Array for pdfjs-dist
    const uint8Array = new Uint8Array(pdfBytes);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    console.log(`Processing ${pdfDocument.numPages} pages...`);
    
    const hyperlinks = [];
    
    // Iterate through each page
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum);
        console.log(`\n--- Page ${pageNum} ---`);
        
        // Get annotations from the page
        const annotations = await page.getAnnotations();
        console.log(`Found ${annotations.length} annotations on page ${pageNum}`);
        
        // Process each annotation
        for (const annotation of annotations) {
          try {
            console.log(`Annotation type: ${annotation.subtype}`);
            
            // Check if it's a link annotation
            if (annotation.subtype === 'Link') {
              console.log(`Found Link annotation on page ${pageNum}`);
              
              // Check if it has a URL action
              if (annotation.url) {
                console.log(`Found URL: ${annotation.url}`);
                hyperlinks.push({
                  page: pageNum,
                  url: annotation.url,
                  text: 'Link'
                });
              }
              // Check if it has an action with URI
              else if (annotation.action && annotation.action.type === 'URI') {
                const url = annotation.action.uri;
                console.log(`Found URI action: ${url}`);
                hyperlinks.push({
                  page: pageNum,
                  url: url,
                  text: 'Link'
                });
              }
              // Check if it has a destination (internal link)
              else if (annotation.dest) {
                console.log(`Found internal link (skipping): ${annotation.dest}`);
              }
              else {
                console.log(`Link annotation found but no URL/destination`);
              }
            }
          } catch (annotationError) {
            console.warn(`Error processing annotation on page ${pageNum}:`, annotationError.message);
          }
        }
      } catch (pageError) {
        console.warn(`Error processing page ${pageNum}:`, pageError.message);
      }
    }
    
    console.log(`\n=== EXTRACTION COMPLETE ===`);
    console.log(`Total hyperlinks found: ${hyperlinks.length}`);
    console.log('Hyperlinks:', hyperlinks);
    
    return hyperlinks;
    
  } catch (error) {
    console.error('PDF hyperlink extraction failed:', error);
    throw new Error(`Failed to extract hyperlinks: ${error.message}`);
  }
}

/**
 * Test function to extract hyperlinks from the test resume
 */
async function testHyperlinkExtraction() {
  try {
    const testFile = './test_resume/Surya_Resume_002.pdf';
    
    if (!fs.existsSync(testFile)) {
      console.log('Test PDF file not found:', testFile);
      return;
    }
    
    console.log(`Testing with file: ${testFile}`);
    
    const hyperlinks = await extractHyperlinksFromPDF(testFile);
    
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(hyperlinks, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testHyperlinkExtraction();
