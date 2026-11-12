const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=== GERADOR DE BACK-END AUTOMATIZADO (LEANDRO IMENES) ===\n');
console.log('Cole o seu código SQL completo abaixo.');
console.log('Quando terminar, digite a palavra FIM em uma nova linha e aperte Enter:\n');

let sqlInput = '';

rl.on('line', (line) => {
    if (line.trim().toUpperCase() === 'FIM') {
        rl.close();
        return;
    }
    sqlInput += line + '\n';
});

rl.on('close', () => {
    if (!sqlInput.trim()) {
        console.log('Nenhum código SQL foi informado.');
        process.exit(1);
    }

    // 1. Extrai todas as tabelas e colunas do código SQL completo usando Regex
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?\s*\(([\s\S]*?)\);/gi;
    let match;
    const tables = [];

    while ((match = tableRegex.exec(sqlInput)) !== null) {
        const tableName = match[1];
        const tableBody = match[2];
        
        const columns = [];
        const lines = tableBody.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (
                trimmed && 
                !trimmed.toUpperCase().startsWith('PRIMARY') && 
                !trimmed.toUpperCase().startsWith('FOREIGN') && 
                !trimmed.toUpperCase().startsWith('KEY') && 
                !trimmed.toUpperCase().startsWith('CONSTRAINT') &&
                !trimmed.startsWith(')') &&
                !trimmed.startsWith('(')
            ) {
                const colMatch = trimmed.match(/^[`"]?([a-zA-Z0-9_]+)[`"]?/);
                if (colMatch) {
                    const colName = colMatch[1];
                    if (colName.toLowerCase() !== 'id') {
                        columns.push(colName);
                    }
                }
            }
        });

        tables.push({
            name: tableName,
            columns: columns.length > 0 ? columns : ['nome', 'descricao']
        });
    }

    if (tables.length === 0) {
        tables.push({
            name: 'registros',
            columns: ['nome', 'descricao']
        });
    }

    // Pega o nome do projeto passado pelo arquivo .bat
    const projectName = process.argv[2] || 'projeto';
    const targetDir = path.join(process.cwd(), projectName);

    if (fs.existsSync(targetDir)) {
        console.log('Já existe uma pasta com esse nome!');
        process.exit(1);
    }

    console.log(`\nCriando a estrutura do projeto "${projectName}"...`);

    // 2. Cria a pasta do projeto principal e entra nela
    fs.mkdirSync(targetDir, { recursive: true });
    process.chdir(targetDir);

    // 3. Inicializa o npm e instala dependências
    console.log('Instalando dependências (isso pode levar alguns segundos)...');
    try {
        execSync('npm init -y', { stdio: 'ignore' });
        execSync('npm install express dotenv cors mysql2', { stdio: 'ignore' });
        execSync('npm install --save-dev nodemon', { stdio: 'ignore' });
    } catch (error) {
        console.log('Erro ao instalar dependências.');
        process.exit(1);
    }

    // 4. Atualiza o package.json com o autor
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageData.author = 'LeandroImenes';
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
    }

    // 5. Cria as subpastas
    fs.mkdirSync(path.join(targetDir, 'db'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'src', 'controllers'), { recursive: true });

    // 6. Salva o código SQL COMPLETO dentro de db/script.sql
    fs.writeFileSync(path.join('db', 'script.sql'), sqlInput.trim() + '\n');

    // 7. Cria src/db.js
    const dbName = tables.length > 0 ? tables[0].name : 'gestao_residuos';
    const dbContent = `const mysql = require('mysql')

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: '${dbName}'
})

module.exports = connection
`;
    fs.writeFileSync(path.join('src', 'db.js'), dbContent);

    // 8. Gera os Controllers e rotas para CADA tabela encontrada no SQL
    let routesImports = '';
    let routesEndpoints = '';

    tables.forEach(table => {
        const tableName = table.name;
        const activeColumns = table.columns;
        const singularName = tableName.endsWith('s') ? tableName.slice(0, -1) : tableName;

        const placeholders = activeColumns.map(() => '?').join(', ');
        const bodyFieldsDestruct = activeColumns.join(', ');

        const controllerContent = `const con = require('../db')

const cadastrar = (req, res) => {
    const { ${bodyFieldsDestruct} } = req.body
    try {
        const sql = 'INSERT INTO ${tableName} (${bodyFieldsDestruct}) VALUES (${placeholders});'
        con.query(sql, [${bodyFieldsDestruct}], (err, results) => {
            if (err) {
                console.error(err)
                res.status(500).json({ error: 'Erro ao cadastrar ${singularName}' })
            } else {
                const novoRegistro = req.body
                novoRegistro.id = results.insertId
                res.status(201).json({ message: '${singularName} cadastrado(a) com sucesso', data: novoRegistro })
            }
        })
    } catch (error) {
        console.error(error)
        res.status(400).json({ error: 'Erro ao cadastrar ${singularName}', details: 'Informe { ${bodyFieldsDestruct} }' })
    }
}

const listar = (req, res) => {
    const sql = 'SELECT * FROM ${tableName};'
    con.query(sql, (err, results) => {
        if (err) {
            console.error(err)
            res.status(500).json({ error: 'Erro ao buscar ${tableName}' })
        } else {
            res.json(results)
        }
    })
}

const alterar = (req, res) => {
    const id = Number(req.params.id)
    const chaves = Object.keys(req.body)
    let campos = ''
    const colunas = []
    chaves.forEach((chave) => {
        campos += \`\${chave} = ?,\`
        colunas.push(req.body[chave])
    })
    campos = campos.slice(0, -1)
    colunas.push(id)
    const sql = \`UPDATE ${tableName} SET \${campos} WHERE id = ?;\`
    con.query(sql, colunas, (err, results) => {
        if (err) {
            console.error(err)
            res.status(500).json({ erro: 'Erro ao alterar ${singularName}', msg: err.sqlMessage })
        } else {
            if (results.affectedRows == 1)
                res.json("Registro alterado com sucesso")
            else
                res.status(404).json({ msg: "Nada alterado no banco de dados", erro: results })
        }
    })
}

const excluir = (req, res) => {
    const id = Number(req.params.id)
    const sql = 'DELETE FROM ${tableName} WHERE id = ?;'
    con.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err)
            res.status(500).json({ erro: 'Erro ao excluir ${singularName}', msg: err.sqlMessage })
        } else {
            if (results.affectedRows == 1)
                res.json("Registro excluído com sucesso")
            else
                res.status(404).json({ msg: "Nada alterado no banco de dados", erro: results })
        }
    })
}

module.exports = {
    cadastrar,
    listar,
    alterar,
    excluir
}
`;
        fs.writeFileSync(path.join('src', 'controllers', `${singularName}.js`), controllerContent);

        routesImports += `const ${singularName}Controller = require('./controllers/${singularName}')\n`;
        routesEndpoints += `
// Rotas para ${tableName}
router.get('/${tableName}', ${singularName}Controller.listar)
router.post('/${tableName}', ${singularName}Controller.cadastrar)
router.put('/${tableName}/:id', ${singularName}Controller.alterar)
router.delete('/${tableName}/:id', ${singularName}Controller.excluir)
`;
    });

    // 9. Cria src/routes.js
    const routesContent = `const express = require("express")
const router = express.Router()

${routesImports}
const rotaInicial = (req, res) => {
    res.json("Back-end respondendo")
}

router.get('/', rotaInicial)
${routesEndpoints}
module.exports = router
`;
    fs.writeFileSync(path.join('src', 'routes.js'), routesContent);

    // 10. Cria server.js na raiz
    const serverContent = `const express = require("express")
const cors = require("cors")

const routes = require("./src/routes")

const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(routes)
const porta = 3000

app.listen(porta, () => {
    console.log(\`Servidor respondendo em: http://localhost:\${porta}\`)
})
`;
    fs.writeFileSync('server.js', serverContent);

    // 11. Cria .gitignore
    const gitignoreContent = `node_modules
package-lock.json
`;
    fs.writeFileSync('.gitignore', gitignoreContent);

    console.log(`\nProjeto "${projectName}" criado com sucesso! Arquivo script.sql salvo por completo, controllers e rotas gerados. 🚀`);
});