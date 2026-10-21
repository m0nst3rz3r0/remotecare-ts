import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontData from '../../assets/fonts/NotoSans-Regular.ttf?inline';
import type { MealDocument } from './mealDocument';

function bundledFont(): Uint8Array {
  if (!fontData.startsWith('data:')) throw new Error('Bundled PDF font unavailable. Reload the updated app while online once, then retry.');
  return Uint8Array.from(atob(fontData.split(',')[1]), c=>c.charCodeAt(0));
}
export function wrapPdfText(text:string,font:PDFFont,size:number,width:number):string[] {
  const lines:string[]=[];let line='';
  for (const word of String(text).replace(/[\r\n\t]+/g,' ').split(/\s+/)) {
    const trial=line?line+' '+word:word;
    if (font.widthOfTextAtSize(trial,size)<=width) {line=trial;continue;}
    if(line){lines.push(line);line='';}
    for(const char of word){if(line && font.widthOfTextAtSize(line+char,size)>width){lines.push(line);line='';}line+=char;}
  }
  if(line)lines.push(line);return lines.length?lines:[''];
}
export async function renderMealDocumentPdf(doc:MealDocument,fontBytes?:Uint8Array):Promise<Uint8Array> {
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font=await pdf.embedFont(fontBytes ?? bundledFont(),{subset:true});
  pdf.setTitle(doc.title+' - '+doc.patient);pdf.setAuthor('RemoteCare');pdf.setSubject(doc.status);pdf.setProducer('RemoteCare '+doc.version);
  const width=595.28,height=841.89,margin=42,contentWidth=width-margin*2;
  const ink=rgb(.075,.17,.19),teal=rgb(.05,.39,.4),amber=rgb(.48,.27,.02),pale=rgb(.93,.97,.97);
  let page!:PDFPage,y=0;
  const newPage=()=>{
    if(pdf.getPageCount()>=3)throw new Error('This summary exceeds three readable pages. Shorten clinical notes or select patient-only export. Full details remain in the app.');
    page=pdf.addPage([width,height]);
    page.drawRectangle({x:0,y:height-105,width,height:105,color:pale});
    page.drawRectangle({x:0,y:height-6,width,height:6,color:teal});
    page.drawText('RemoteCare | '+doc.title,{x:margin,y:height-42,size:14,font,color:teal});
    page.drawText(doc.patient+' | '+doc.date,{x:margin,y:height-62,size:11,font,color:ink});
    if(doc.facility)page.drawText(doc.facility,{x:margin,y:height-78,size:11,font,color:ink});
    const statusLines=wrapPdfText(doc.status,font,11,contentWidth);
    statusLines.forEach((line,i)=>page.drawText(line,{x:margin,y:height-(doc.facility?96:82)-i*15,size:11,font,color:amber}));
    y=height-(doc.facility?113:99)-statusLines.length*15;
    page.drawLine({start:{x:margin,y:y+12},end:{x:width-margin,y:y+12},thickness:1,color:teal});
    y-=7;
  };
  const ensure=(space:number)=>{if(y-space<58)throw new Error('This section exceeds one readable page. Shorten clinical notes or select patient-only export; full details remain in the app.');};
  const draw=(text:string,size=11.5,color=ink)=>{
    for(const line of wrapPdfText(text,font,size,contentWidth)){ensure(size+3);page.drawText(line,{x:margin,y,size,font,color});y-=size+3;}
  };
  for(const section of doc.sections){
    newPage();draw(section.title,15,teal);y-=4;
    for(const block of section.blocks){
      ensure(30);
      if(block.heading){page.drawRectangle({x:margin-5,y:y-4,width:contentWidth+10,height:19,color:pale});draw(block.heading,11.5,block.tone==='warning'?amber:teal);y-=2;}
      for(const line of block.lines){draw(line,11.5,block.tone==='warning'?amber:ink);y-=1;}
      y-=5;
    }
  }
  const pages=pdf.getPages();pages.forEach((p,i)=>{
    p.drawLine({start:{x:margin,y:45},end:{x:width-margin,y:45},thickness:.5,color:teal});
    p.drawText((doc.patientFacing?'':doc.version+' | ')+(i+1)+' / '+pages.length,{x:margin,y:29,size:9,font,color:ink});
  });
  return pdf.save();
}
