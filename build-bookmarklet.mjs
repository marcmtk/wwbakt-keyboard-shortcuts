import {readFile,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";

const here=dirname(fileURLToPath(import.meta.url));
const sourcePath=resolve(process.argv[2]||resolve(here,"lims-keyboard-layer.txt"));
const outputPath=resolve(process.argv[3]||resolve(here,"lims-keyboard-layer-bookmarklet.txt"));
const source=(await readFile(sourcePath,"utf8")).replace(/\r\n?/g,"\n");

new Script(source,{filename:sourcePath});
assertLineJoinIsSafe(source);

const compact=source
  .split("\n")
  .map(line=>line.trim())
  .filter(Boolean)
  .join(" ");
const bookmarklet=`javascript:${compact}\n`;
const payload=bookmarklet.slice("javascript:".length).trimEnd();

new Script(payload,{filename:outputPath});

const sourceVersion=getVersion(source);
const outputVersion=getVersion(payload);

if(sourceVersion!==outputVersion){
  throw new Error(`Version mismatch: source ${sourceVersion}, output ${outputVersion}`);
}

if(bookmarklet.trimEnd().includes("\n")){
  throw new Error("Generated bookmarklet contains an internal line break");
}

await writeFile(outputPath,bookmarklet,"utf8");
console.log(`Built ${outputPath} from ${sourcePath}`);
console.log(`Version ${sourceVersion}; ${Buffer.byteLength(bookmarklet)} bytes`);

function getVersion(code){
  const match=code.match(/\bversion\s*:\s*"([^"]+)"/);

  if(!match){
    throw new Error("Could not find the keyboard-layer version");
  }

  return match[1];
}

function assertLineJoinIsSafe(code){
  if(code.includes("//")||code.includes("/*")){
    throw new Error("Source contains comments; line joining has been refused");
  }

  let quote=null;
  let escaped=false;

  for(const character of code){
    if(quote){
      if(character==="\n"){
        throw new Error("Source contains a multiline string or template literal");
      }

      if(escaped){
        escaped=false;
      }else if(character==="\\"){
        escaped=true;
      }else if(character===quote){
        quote=null;
      }

      continue;
    }

    if(character==='"'||character==="'"||character==="`"){
      quote=character;
    }
  }

  const lines=code
    .split("\n")
    .map(line=>line.trim())
    .filter(Boolean);

  for(const line of lines){
    if(/^(return|throw|break|continue|yield|async)$/.test(line)){
      throw new Error(`Unsafe automatic-semicolon line: ${line}`);
    }
  }
}
