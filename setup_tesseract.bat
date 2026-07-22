@echo off
chcp 65001 >nul
title 简历采集助手 - 环境配置工具
color 0f
echo ============================================
echo   简历采集助手 - 环境配置
echo ============================================
echo.

:: ---------- 1. 检查 Tesseract ----------
echo [1/4] 检查 Tesseract OCR...
where tesseract >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✅ tesseract 已在 PATH 中
    tesseract --version | findstr "tesseract"
) else (
    echo   ⚠️ 未找到 tesseract
    echo.
    echo   请先安装 Tesseract OCR:
    echo   下载地址: https://github.com/UB-Mannheim/tesseract/releases
    echo   选择: tesseract-ocr-w64-setup-5.4.0.20240606.exe
    echo.
    echo   安装时注意:
    echo     1. 勾选 "Additional language data (download)"
    echo     2. 在 Language 列表中勾选 "Chinese (Simplified)"
    echo     3. 勾选 "Add Tesseract to system PATH"
    echo.
    echo   或者从百度网盘下载（提取码: tesc）:
    echo   链接: https://pan.baidu.com/s/xxxxx
    echo.
    pause
    goto :check_install
)

:: ---------- 2. 检查中文语言包 ----------
:check_install
echo.
echo [2/4] 检查中文语言包...
if exist "C:\Program Files\Tesseract-OCR\tessdata\chi_sim.traineddata" (
    echo   ✅ 中文语言包已安装
) else (
    echo   ⚠️ 未找到中文语言包，尝试下载...
    echo   正在下载 chi_sim.traineddata (约12MB)...
    
    :: 方法1: GitHub 直连
    curl -L --connect-timeout 10 --max-time 120 -o "%TEMP%\chi_sim.traineddata" ^
        "https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata" 2>nul
    
    if not exist "%TEMP%\chi_sim.traineddata" (
        echo   GitHub 连接慢，尝试国内镜像...
    :: 方法2: 使用 Python 下载（更稳定）
    echo   尝试使用 Python 下载...
    python -c "
import urllib.request, os
url = 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata'
dest = r'%TEMP%\chi_sim.traineddata'
try:
    urllib.request.urlretrieve(url, dest)
    print('Python 下载成功')
except Exception as e:
    print(f'Python 下载失败: {e}')
" 2>nul

    if not exist "%TEMP%\chi_sim.traineddata" (
        :: 方法3: 清华镜像（tessdata 文件）
        echo   尝试清华镜像...
        curl -L --connect-timeout 10 --max-time 300 -o "%TEMP%\chi_sim.traineddata" ^
            "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/chi_sim.traineddata" 2>nul
    )
        curl -L --connect-timeout 10 --max-time 120 -o "%TEMP%\chi_sim.traineddata" ^
            "https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata" 2>nul
    )
    
    if exist "%TEMP%\chi_sim.traineddata" (
        set "TESSDATA=C:\Program Files\Tesseract-OCR\tessdata"
        if not exist "!TESSDATA!" set "TESSDATA=C:\Program Files (x86)\Tesseract-OCR\tessdata"
        move /y "%TEMP%\chi_sim.traineddata" "!TESSDATA!\chi_sim.traineddata" >nul
        echo   ✅ 下载完成
    ) else (
        echo   ❌ 下载失败，请手动下载:
        echo   1. 打开浏览器访问:
        echo      https://github.com/tesseract-ocr/tessdata_fast/blob/main/chi_sim.traineddata
        echo   2. 点击 Download 按钮下载
        echo   3. 将文件复制到 C:\Program Files\Tesseract-OCR\tessdata\
    )
)

:: ---------- 3. 添加 PATH ----------
echo.
echo [3/4] 配置系统环境变量...
setx PATH "%PATH%;C:\Program Files\Tesseract-OCR\" >nul 2>&1
echo   ✅ PATH 已配置

:: ---------- 4. 验证 ----------
echo.
echo [4/4] 验证安装...
set "PATH=%PATH%;C:\Program Files\Tesseract-OCR\"
tesseract --list-langs 2>&1 | findstr "chi_sim" >nul && (
    echo   ✅ Tesseract + 中文支持 就绪！
) || (
    echo   ⚠️ 中文语言包未生效，请检查 tessdata 目录
)

echo.
echo ============================================
echo   配置完成！
echo   现在可以启动采集工具了
echo ============================================
echo.
pause

