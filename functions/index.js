const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {google} = require('googleapis');
const sheets = google.sheets('v4');
const api_key =   functions.config().sheets.api_key

admin.initializeApp();

// this is the main function
// TODO get sheet title + data from the same API call
exports.previewFunction = functions.https.onRequest(async (request, response) => {
  
  const sheetIDfromURL = request.path.split("/")[6]
  const sheetID = request.query.id ? request.query.id : sheetIDfromURL  
  const sheetName = request.query.name ? request.query.name : 'Sheet1'
  const mode = request.query.mode ? request.query.mode : ''

  if (sheetID) {
      const reqTitle = {
        spreadsheetId: sheetID,      
        key: api_key
      }
      const reqValues = {
        spreadsheetId: sheetID,      
        key: api_key,
        range: sheetName,      
        majorDimension: 'ROWS'
      }
      try {
        const sheetTitle = (await sheets.spreadsheets.get(reqTitle)).data.properties.title;
        const sheetvalues = (await sheets.spreadsheets.values.get(reqValues)).data.values;
        const xmlItems = generateSingleItem(sheetvalues, mode);
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
                      <rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
                      <channel>
                      <title>${sheetTitle}</title>
                      <link>https://docs.google.com/spreadsheets/d/${sheetID}</link>
                      <description>This RSS feed was generated by crssnt.com</description>
                      <atom:link href="https://docs.google.com/spreadsheets/d/${sheetID}" rel="self"/>
                      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>  
                      ${xmlItems}
                      </channel>
                      </rss>`;

        return response.status(200).contentType('text/xml; charset=utf8').send(xml);      
      } catch (err) {
        console.error(err);
        return response.status(400).send('Something went wrong, check the parameters and try again.');
      }
    }
  else {
    return response.status(400).send('Something went wrong, check the parameters and try again.');
  }
});

function generateSingleItem(values, mode) {
  let xmlItemsAll = []
  for (const key in values) {
    let value = values[key]
    if(value.length > 0) {      
      let url = value.find(s => s.startsWith('http'));
      let date = value.find(s => Date.parse(s));
      if(url){
        value.splice(value.indexOf(url), 1); 
      }      
      if(date){
        value.splice(value.indexOf(date), 1); 
      }
      if(mode == 'title'){
        valueMode = value.join(' ');
      } else if (mode == 'B') {
        valueMode = value.slice(0);
      }
      let xmlItem = `<item>
        ${mode ? '<title><![CDATA['+valueMode+']]></title>' : '<title><![CDATA['+value[0]+']]></title>'}
        ${mode ? '<description></description>' : '<description><![CDATA['+value.slice(1)+']]></description>'}
        ${url !== undefined ? '<link>'+url+'</link>' : ''}
        ${url !== undefined ? '<guid>'+url+'</guid>' : ''}
        <pubDate>${date !== undefined ? new Date(date).toUTCString() : new Date().toUTCString()}</pubDate>
        </item>`
        xmlItemsAll = xmlItemsAll + xmlItem
    }
  }       
  return xmlItemsAll
}
