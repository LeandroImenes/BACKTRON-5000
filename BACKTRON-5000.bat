@echo off
set /p PROJ_NAME=Digite o nome do projeto: 

cd /d "seu-caminho\BACKTRON-5000"
node index.js "%PROJ_NAME%" "caminho-onde-o-arquivo-sera-criado"

cd "seu-caminho\%PROJ_NAME%"
code .
