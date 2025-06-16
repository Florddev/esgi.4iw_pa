@echo off
:: ============================================================================
:: Nom          : flatcopy.bat
:: Version      : 1.0.0
:: Auteur       : Florddev
:: Date         : 10/12/2024
:: Description  : Script de copie récursive qui "aplatit" une structure de dossiers.
::                Copie tous les fichiers d'un dossier source et de ses sous-dossiers 
::                vers un dossier de destination unique, en ignorant la hiérarchie.
::               
:: Fonctionnalités :
::   - Copie récursive de fichiers
::   - Système d'exclusion via .flatignore (similaire à .gitignore)
::   - Génération d'un rapport des fichiers copiés (.copied_files.txt)
::   - Remplacement automatique des fichiers existants
::   - Gestion des erreurs et validations de sécurité
:: ============================================================================

setlocal enabledelayedexpansion
chcp 65001 > nul

:: Définition des variables
set "SOURCE_DIR="
set "DEST_DIR="
set "EXCLUSIONS_FILE=.flatignore"
set "GENERATE_LIST="
set "FILES_LIST=.copied_files.txt"

:: Demande du chemin source
set /p SOURCE_DIR="Entrez le chemin du dossier source: "

:: Vérification si le dossier source existe
if not exist "%SOURCE_DIR%" (
    echo Erreur: Le dossier source n'existe pas.
    echo Le script va se terminer.
    pause
    exit /b 1
)

:: Dossier de destination par défaut (même niveau que source avec _copied à la fin)
set "DEFAULT_DEST=%SOURCE_DIR%_copied"
set /p DEST_DIR="Entrez le chemin du dossier destination [%DEFAULT_DEST%]: "

:: Si aucun dossier de destination n'est spécifié, utiliser la valeur par défaut
if "!DEST_DIR!"=="" set "DEST_DIR=%DEFAULT_DEST%"

:: Vérifications de sécurité
:: 1. Vérifier si source et destination sont identiques
if /i "%SOURCE_DIR%"=="%DEST_DIR%" (
    echo Erreur: Le dossier source et le dossier de destination ne peuvent pas être identiques.
    echo Le script va se terminer.
    pause
    exit /b 1
)

:: 2. Vérifier si la destination est un sous-dossier de la source
echo "%DEST_DIR%" | findstr /i /c:"%SOURCE_DIR%\" >nul
if not errorlevel 1 (
    echo Erreur: Le dossier de destination ne peut pas être un sous-dossier du dossier source.
    echo Le script va se terminer.
    pause
    exit /b 1
)

:: 3. Vérifier si la source est un sous-dossier de la destination
echo "%SOURCE_DIR%" | findstr /i /c:"%DEST_DIR%\" >nul
if not errorlevel 1 (
    echo Erreur: Le dossier source ne peut pas être un sous-dossier du dossier de destination.
    echo Le script va se terminer.
    pause
    exit /b 1
)

:: Demande pour la génération de la liste
set /p GENERATE_LIST="Voulez-vous générer une liste des fichiers copiés? (O/N) [O]: "
if "!GENERATE_LIST!"=="" set "GENERATE_LIST=O"

:: Création du dossier de destination s'il n'existe pas
if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
    if errorlevel 1 (
        echo Erreur: Impossible de créer le dossier de destination.
        echo Le script va se terminer.
        pause
        exit /b 1
    )
)

:: Création du fichier d'exclusions s'il n'existe pas
if not exist "%EXCLUSIONS_FILE%" (
    echo # Ajoutez un motif d'exclusion par ligne > "%EXCLUSIONS_FILE%"
    echo # Exemple: >> "%EXCLUSIONS_FILE%"
    echo # *.tmp >> "%EXCLUSIONS_FILE%"
    echo # test.txt >> "%EXCLUSIONS_FILE%"
    echo # dossier_a_exclure\ >> "%EXCLUSIONS_FILE%"
)

:: Préparation du fichier de liste si demandé
if /i "%GENERATE_LIST%"=="O" (
    echo Liste des fichiers copiés depuis %SOURCE_DIR% > "%DEST_DIR%\%FILES_LIST%"
    echo Date de copie: %date% %time% >> "%DEST_DIR%\%FILES_LIST%"
    echo. >> "%DEST_DIR%\%FILES_LIST%"
)

:: Compteurs pour le rapport final
set "FILES_COPIED=0"
set "FILES_EXCLUDED=0"
set "FILES_ERROR=0"

:: Boucle principale pour copier les fichiers
echo.
echo Début de la copie des fichiers...
for /r "%SOURCE_DIR%" %%F in (*) do (
    set "SHOULD_COPY=yes"
    set "REL_PATH=%%~nxF"
    
    :: Vérification des exclusions de manière silencieuse
    if exist "%EXCLUSIONS_FILE%" (
        for /f "eol=# tokens=*" %%E in (%EXCLUSIONS_FILE%) do (
            set "PATTERN=%%E"
            if not "!PATTERN!"=="" (
                echo "!REL_PATH!" | findstr /i /l "!PATTERN!" >nul 2>&1
                if not errorlevel 1 (
                    set "SHOULD_COPY=no"
                    echo Exclusion: "%%F"
                    set /a "FILES_EXCLUDED+=1"
                )
            )
        )
    )
    
    :: Copie du fichier si non exclu
    if "!SHOULD_COPY!"=="yes" (
        copy /Y "%%F" "%DEST_DIR%" >nul 2>&1
        if not errorlevel 1 (
            echo Copié: "%%F"
            set /a "FILES_COPIED+=1"
            :: Ajout du chemin relatif dans la liste si demandé
            if /i "%GENERATE_LIST%"=="O" (
                echo %%~pnxF >> "%DEST_DIR%\%FILES_LIST%"
            )
        ) else (
            echo Erreur lors de la copie: "%%F"
            set /a "FILES_ERROR+=1"
        )
    )
)

:: Affichage du rapport final
echo.
echo ===== Rapport de copie =====
echo Fichiers copiés avec succès: %FILES_COPIED%
echo Fichiers exclus: %FILES_EXCLUDED%
echo Erreurs de copie: %FILES_ERROR%
if /i "%GENERATE_LIST%"=="O" (
    echo La liste des fichiers copiés a été générée dans %FILES_LIST%
)
echo ========================
echo.
pause