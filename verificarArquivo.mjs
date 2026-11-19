/* Verificador de arquivos do back-end.
   Como usar (na pasta Civvo_API, no terminal):   node verificar-arquivos.mjs
   Ele segue todos os "import" a partir do index.js e mostra, de uma vez, cada arquivo que NÃO existe,
   em qual pasta ele deveria estar e se existe algum arquivo com nome parecido (erro de digitação). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ENTRADA = path.join(RAIZ, 'index.js');
const IMPORT = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

/* existe com a MESMA caixa (maiúscula/minúscula)? No Windows tanto faz, mas em servidor Linux (deploy) faz diferença */
function existeExato(p) {
  const rel = path.relative(RAIZ, p).split(path.sep);
  let atual = RAIZ;
  for (const parte of rel) {
    if (!fs.existsSync(atual) || !fs.statSync(atual).isDirectory()) return false;
    if (!fs.readdirSync(atual).includes(parte)) return false;
    atual = path.join(atual, parte);
  }
  return true;
}

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/* procura nome parecido na pasta esperada e, se não achar, nas outras pastas de src */
function parecidos(alvo) {
  const nome = path.basename(alvo).toLowerCase();
  const achados = [];
  const varre = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.name === 'node_modules' || f.name.startsWith('.')) continue;
      const cheio = path.join(dir, f.name);
      if (f.isDirectory()) varre(cheio);
      else if (f.name.endsWith('.js') || f.name.endsWith('.mjs')) {
        const n = f.name.toLowerCase();
        if (n === nome || distancia(n, nome) <= 3 || n.includes(nome.replace(/\.m?js$/, '').slice(0, 8)))
          achados.push(path.relative(RAIZ, cheio));
      }
    }
  };
  varre(path.join(RAIZ, 'src'));
  varre(RAIZ === path.dirname(ENTRADA) ? path.join(RAIZ) : RAIZ);
  return [...new Set(achados)].slice(0, 4);
}

const visitados = new Set();
const faltando = [];
const caixaErrada = [];

function seguir(arquivo) {
  if (visitados.has(arquivo)) return;
  visitados.add(arquivo);
  if (!/\.m?js$/.test(arquivo)) return;

  const texto = fs.readFileSync(arquivo, 'utf8');
  for (const m of texto.matchAll(IMPORT)) {
    const alvo = path.resolve(path.dirname(arquivo), m[1]);
    if (!fs.existsSync(alvo)) {
      faltando.push({ de: path.relative(RAIZ, arquivo), alvo: path.relative(RAIZ, alvo) });
    } else if (!existeExato(alvo)) {
      caixaErrada.push({ de: path.relative(RAIZ, arquivo), alvo: path.relative(RAIZ, alvo) });
    } else {
      seguir(alvo);
    }
  }
}

if (!fs.existsSync(ENTRADA)) {
  console.error('Rode este script dentro da pasta Civvo_API (a mesma do index.js).');
  process.exit(1);
}

seguir(ENTRADA);

const unicos = [...new Map(faltando.map((f) => [f.alvo, f])).values()];

if (!unicos.length && !caixaErrada.length) {
  console.log(`\n✔ Todos os ${visitados.size} arquivos importados existem. Pode rodar o servidor.\n`);
  process.exit(0);
}

if (unicos.length) {
  console.log(`\n✘ ${unicos.length} arquivo(s) NÃO encontrado(s):\n`);
  for (const f of unicos) {
    console.log(`  • ${f.alvo.replaceAll('\\', '/')}`);
    console.log(`      pedido por: ${f.de.replaceAll('\\', '/')}`);
    const par = parecidos(f.alvo);
    if (par.length) console.log(`      arquivos com nome parecido: ${par.map((p) => p.replaceAll('\\', '/')).join(', ')}  ← confira o nome/pasta`);
    else console.log('      nenhum arquivo parecido: ele ainda precisa ser criado nessa pasta');
  }
}

if (caixaErrada.length) {
  console.log('\n⚠ Maiúsculas/minúsculas diferentes (funciona no Windows, QUEBRA no servidor Linux):\n');
  for (const f of caixaErrada) console.log(`  • ${f.alvo.replaceAll('\\', '/')}  (pedido por ${f.de.replaceAll('\\', '/')})`);
}
console.log('');
process.exit(1);