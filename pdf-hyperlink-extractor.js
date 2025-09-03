import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Extract all hyperlinks from a PDF file
 * @param {Buffer|string} pdfInput - PDF file as Buffer or file path
 * @returns {Array} Array of hyperlinks with page numbers
 */
async function extractHyperlinksFromPDF(pdfInput) {
  try {
    console.log('=== PDF HYPERLINK EXTRACTION ===');
    
    // Load PDF document
    const pdfBytes = typeof pdfInput === 'string' ? fs.readFileSync(pdfInput) : pdfInput;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const hyperlinks = [];
    const pages = pdfDoc.getPages();
    
    console.log(`Processing ${pages.length} pages...`);
    
    // Iterate through each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageNumber = pageIndex + 1;
      
      try {
        // Get annotations from the page
        const annotations = page.node.Annots()?.asArray() || [];
        console.log(`Page ${pageNumber}: Found ${annotations.length} annotations`);
        
        // Process each annotation
        for (const annotation of annotations) {
          try {
            // Check if it's a link annotation
            const subtype = annotation.get(PDFDocument.PDFName.of('Subtype'));
            
            if (subtype?.decode() === 'Link') {
              console.log(`Page ${pageNumber}: Found Link annotation`);
              
              // Get the action
              const action = annotation.get(PDFDocument.PDFName.of('A'));
              
              if (action) {
                const actionType = action.get(PDFDocument.PDFName.of('S'));
                
                // Check if it's a URI action (external link)
                if (actionType?.decode() === 'URI') {
                  const uri = action.get(PDFDocument.PDFName.of('URI'));
                  
                  if (uri) {
                    const url = uri.decode();
                    console.log(`Page ${pageNumber}: Found URL: ${url}`);
                    
                    hyperlinks.push({
                      page: pageNumber,
                      url: url
                    });
                  }
                }
                // Check if it's a destination (internal link) - we'll skip these
                else if (actionType?.decode() === 'GoTo') {
                  console.log(`Page ${pageNumber}: Found internal link (skipping)`);
                }
              }
            }
          } catch (annotationError) {
            console.warn(`Error processing annotation on page ${pageNumber}:`, annotationError.message);
          }
        }
      } catch (pageError) {
        console.warn(`Error processing page ${pageNumber}:`, pageError.message);
      }
    }
    
    console.log(`=== EXTRACTION COMPLETE ===`);
    console.log(`Total hyperlinks found: ${hyperlinks.length}`);
    console.log('Hyperlinks:', hyperlinks);
    
    return hyperlinks;
    
  } catch (error) {
    console.error('PDF hyperlink extraction failed:', error);
    throw new Error(`Failed to extract hyperlinks: ${error.message}`);
  }
}

/**
 * Test function to extract hyperlinks from a PDF file
 */
async function testHyperlinkExtraction() {
  try {
    // Find PDF files in current directory
    const files = fs.readdirSync('.');
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in current directory');
      return;
    }
    
    const testFile = pdfFiles[0];
    console.log(`Testing with file: ${testFile}`);
    
    const hyperlinks = await extractHyperlinksFromPDF(testFile);
    
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(hyperlinks, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Export the function
export { extractHyperlinksFromPDF };

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHyperlinkExtraction();
}
