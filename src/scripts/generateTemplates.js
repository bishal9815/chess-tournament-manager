/**
 * Template Generator Script
 * 
 * This script generates Excel and Word templates for player data.
 * Run with: node src/scripts/generateTemplates.js
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const docx = require('docx');
const { Document, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, BorderStyle } = docx;

// Ensure templates directory exists
const templatesDir = path.join(__dirname, '../../public/templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Sample data for templates
const sampleData = [
  { 'First Name': 'John', 'Last Name': 'Doe', 'Email': 'john.doe@example.com', 'Rating': 1850 },
  { 'First Name': 'Jane', 'Last Name': 'Smith', 'Email': 'jane.smith@example.com', 'Rating': 1720 },
  { 'First Name': 'Michael', 'Last Name': 'Johnson', 'Email': 'michael.j@example.com', 'Rating': 2100 }
];

// Generate Excel template
function generateExcelTemplate() {
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(sampleData);
  
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Players');
  
  const excelPath = path.join(templatesDir, 'players_template.xlsx');
  xlsx.writeFile(workbook, excelPath);
  
  console.log(`Excel template generated at: ${excelPath}`);
}

// Generate CSV template
function generateCsvTemplate() {
  const csvPath = path.join(templatesDir, 'players_template.csv');
  
  const headers = Object.keys(sampleData[0]).join(',');
  const rows = sampleData.map(row => 
    Object.values(row).join(',')
  );
  
  const csvContent = [headers, ...rows].join('\n');
  
  fs.writeFileSync(csvPath, csvContent);
  
  console.log(`CSV template generated at: ${csvPath}`);
}

// Generate Word template (simple text file with .docx extension)
function generateWordTemplate() {
  const docxPath = path.join(templatesDir, 'players_template.docx');
  
  // For a real Word document, you would use a library like docx
  // Here we're just creating a text file with instructions
  const content = `
Chess Tournament Manager - Player Import Template

Instructions:
1. Enter one player per line in the format: First Name, Last Name, Email, Rating
2. Save the file and upload it to the system

Example:
John, Doe, john.doe@example.com, 1850
Jane, Smith, jane.smith@example.com, 1720
Michael, Johnson, michael.j@example.com, 2100
`;
  
  fs.writeFileSync(docxPath, content);
  
  console.log(`Word template generated at: ${docxPath}`);
}

// Generate all templates
function generateAllTemplates() {
  try {
    generateExcelTemplate();
    generateCsvTemplate();
    generateWordTemplate();
    
    console.log('All templates generated successfully!');
  } catch (error) {
    console.error('Error generating templates:', error);
  }
}

// Run the generator
generateAllTemplates(); 