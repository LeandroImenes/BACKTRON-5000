@echo off
set /p PROJ_NAME=Digite o nome do projeto: 

cd /d "seu-caminho\BACKTRON-5000"
node index.js "%PROJ_NAME%" "C:\Users\Leandro\Desktop\SENAI\2_Semestre"

cd "seu-caminho\%PROJ_NAME%"
code .
