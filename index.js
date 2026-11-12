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

    // 1. Extrai todas as tabelas e colunas do SQL
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

    const projectName = process.argv[2] || 'projeto';
    const targetDir = path.join('C:\\Users\\Leandro\\Desktop\\SENAI\\2_Semestre', projectName);

    if (fs.existsSync(targetDir)) {
        console.log('Já existe uma pasta com esse nome!');
        process.exit(1);
    }

    console.log(`\nCriando a estrutura do projeto "${projectName}" na pasta 2_Semestre...`);

    fs.mkdirSync(targetDir, { recursive: true });
    process.chdir(targetDir);

    console.log('Inicializando o projeto e instalando as dependências (express, cors, mysql2)...');
    try {
        execSync('npm init -y', { shell: true, stdio: 'ignore' });
        execSync('npm install express cors mysql2', { shell: true, stdio: 'inherit' });
    } catch (error) {
        console.log('\n[AVISO] Erro ao instalar dependências automaticamente.');
        console.log('Tente rodar "npm install" manualmente dentro da pasta do projeto.');
    }

    // Atualiza o package.json com o autor e o script dev (node --watch)
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageData.author = 'LeandroImenes';
        packageData.scripts = {
            "dev": "node --watch server.js"
        };
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2));
    }

    fs.mkdirSync(path.join(targetDir, 'db'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'src', 'controllers'), { recursive: true });

    fs.writeFileSync(path.join('db', 'script.sql'), sqlInput.trim() + '\n');

    // Extrai o nome do banco de dados diretamente do SQL, ou usa o nome do projeto como plano B[cite: 1]
    const dbNameMatch = sqlInput.match(/CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?/i);
    const dbName = dbNameMatch ? dbNameMatch[1] : projectName;
    console.log(`🗄️ Banco de dados identificado: ${dbName}`);

    const dbContent = `const mysql = require('mysql2')

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: '${dbName}'
})

module.exports = connection
`;
    fs.writeFileSync(path.join('src', 'db.js'), dbContent);

    let routesImports = '';
    let routesEndpoints = '';

    let insomniaResources = [];
    const workspaceId = `wrk_${projectName}_${Date.now()}`;

    insomniaResources.push({
        _id: workspaceId,
        parentId: null,
        modified: Date.now(),
        created: Date.now(),
        name: `Projeto ${projectName}`,
        description: "Coleção gerada automaticamente pelo BACKTRON-5000",
        scope: "collection",
        _type: "workspace"
    });

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

const buscarPorId = (req, res) => {
    const id = Number(req.params.id)
    const sql = 'SELECT * FROM ${tableName} WHERE id = ?;'
    con.query(sql, [id], (err, results) => {
        if (err) {
            console.error(err)
            res.status(500).json({ error: 'Erro ao buscar ${singularName}' })
        } else {
            if (results.length === 0) {
                res.status(404).json({ message: '${singularName} não encontrado(a)' })
            } else {
                res.json(results[0])
            }
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
    buscarPorId,
    alterar,
    excluir
}
`;
        fs.writeFileSync(path.join('src', 'controllers', `${singularName}.js`), controllerContent);

        routesImports += `const ${singularName}Controller = require('./controllers/${singularName}')\n`;
        routesEndpoints += `
// Rotas para ${tableName}
router.get('/${tableName}', ${singularName}Controller.listar)
router.get('/${tableName}/:id', ${singularName}Controller.buscarPorId)
router.post('/${tableName}', ${singularName}Controller.cadastrar)
router.put('/${tableName}/:id', ${singularName}Controller.alterar)
router.delete('/${tableName}/:id', ${singularName}Controller.excluir)
`;

        const folderId = `fld_${tableName}_${Date.now()}`;
        insomniaResources.push({
            _id: folderId,
            parentId: workspaceId,
            modified: Date.now(),
            created: Date.now(),
            name: tableName.toUpperCase(),
            description: `Requisições da tabela ${tableName}`,
            environment: {},
            environmentPropertyOrder: null,
            metaSortKey: -Date.now(),
            _type: 'request_group'
        });

        const sampleBodyObj = {};
        activeColumns.forEach(col => {
            sampleBodyObj[col] = `valor_${col}`;
        });

        insomniaResources.push({
            _id: `req_list_${tableName}_${Date.now()}`,
            parentId: folderId,
            modified: Date.now(),
            created: Date.now(),
            url: `http://localhost:3000/${tableName}`,
            name: `Listar ${tableName}`,
            method: "GET",
            body: {},
            parameters: [],
            headers: [],
            authentication: {},
            metaSortKey: -100,
            _type: "request"
        });

        insomniaResources.push({
            _id: `req_getid_${tableName}_${Date.now()}`,
            parentId: folderId,
            modified: Date.now(),
            created: Date.now(),
            url: `http://localhost:3000/${tableName}/1`,
            name: `Buscar ${singularName} por ID`,
            method: "GET",
            body: {},
            parameters: [],
            headers: [],
            authentication: {},
            metaSortKey: -90,
            _type: "request"
        });

        insomniaResources.push({
            _id: `req_post_${tableName}_${Date.now()}`,
            parentId: folderId,
            modified: Date.now(),
            created: Date.now(),
            url: `http://localhost:3000/${tableName}`,
            name: `Cadastrar ${singularName}`,
            method: "POST",
            body: {
                mimeType: "application/json",
                text: JSON.stringify(sampleBodyObj, null, 2)
            },
            parameters: [],
            headers: [{ name: "Content-Type", value: "application/json" }],
            authentication: {},
            metaSortKey: -80,
            _type: "request"
        });

        insomniaResources.push({
            _id: `req_put_${tableName}_${Date.now()}`,
            parentId: folderId,
            modified: Date.now(),
            created: Date.now(),
            url: `http://localhost:3000/${tableName}/1`,
            name: `Alterar ${singularName}`,
            method: "PUT",
            body: {
                mimeType: "application/json",
                text: JSON.stringify(sampleBodyObj, null, 2)
            },
            parameters: [],
            headers: [{ name: "Content-Type", value: "application/json" }],
            authentication: {},
            metaSortKey: -70,
            _type: "request"
        });

        insomniaResources.push({
            _id: `req_del_${tableName}_${Date.now()}`,
            parentId: folderId,
            modified: Date.now(),
            created: Date.now(),
            url: `http://localhost:3000/${tableName}/1`,
            name: `Excluir ${singularName}`,
            method: "DELETE",
            body: {},
            parameters: [],
            headers: [],
            authentication: {},
            metaSortKey: -60,
            _type: "request"
        });
    });

    const insomniaExport = {
        _type: "export",
        __export_format: 4,
        __export_date: new Date().toISOString(),
        __export_source: "BACKTRON-5000",
        resources: insomniaResources
    };

    fs.writeFileSync('insomnia.json', JSON.stringify(insomniaExport, null, 2));

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

    const gitignoreContent = `node_modules
package-lock.json
`;
    fs.writeFileSync('.gitignore', gitignoreContent);

    console.log(`\nProjeto "${projectName}" criado com sucesso! Banco de dados extraído e configurado automaticamente.`);
    rl.close();
});