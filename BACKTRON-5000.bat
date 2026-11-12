@echo off
set /p PROJ_NAME=Digite o nome do projeto: 

:: Executa o script passando o nome do projeto e o caminho onde ele deve ser criado
cd /d "C:\Users\Leandro\Desktop\SENAI\2_Semestre\PBE1\Atividades\BACKTRON-5000"
node index.js "%PROJ_NAME%" "C:\Users\Leandro\Desktop\SENAI\2_Semestre"

cd "C:\Users\Leandro\Desktop\SENAI\2_Semestre\%PROJ_NAME%"
code .