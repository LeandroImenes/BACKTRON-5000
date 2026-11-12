@echo off
set /p PROJ_NAME=Digite o nome do projeto: 

:: Entra na pasta do SENAI onde os projetos devem ser criados
cd /d "C:\Users\Leandro\Desktop\SENAI\2_Semestre"

:: Executa o script Node.js passando o nome do projeto
node "C:\Users\Leandro\Documents\index.js" "%PROJ_NAME%"

:: Entra dentro da pasta recém-criada e abre o VS Code nela
cd "%PROJ_NAME%"
code .