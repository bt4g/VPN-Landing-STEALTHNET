#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');
const apiDir = path.join(appDir, 'api');
const apiBackup = path.join(rootDir, '_api_backup');
const layoutPath = path.join(appDir, 'layout.tsx');
const layoutBackup = path.join(rootDir, '_layout_backup.tsx');
const nextDir = path.join(rootDir, '.next');

let layoutPatched = false;
let apiRemoved = false;

// Рекурсивное копирование
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Рекурсивное удаление
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dir);
}

// Восстановление всех изменений
function restoreAll() {
  console.log('\n=== Восстановление файлов ===');
  
  if (apiRemoved && fs.existsSync(apiBackup)) {
    console.log('Восстанавливаем API routes...');
    if (fs.existsSync(apiDir)) removeDir(apiDir);
    copyDir(apiBackup, apiDir);
    removeDir(apiBackup);
    apiRemoved = false;
    console.log('✓ API routes восстановлены');
  }
  
  if (layoutPatched && fs.existsSync(layoutBackup)) {
    console.log('Восстанавливаем layout.tsx...');
    fs.copyFileSync(layoutBackup, layoutPath);
    fs.unlinkSync(layoutBackup);
    layoutPatched = false;
    console.log('✓ layout.tsx восстановлен (с force-dynamic)');
  }
  
  console.log('=== Восстановление завершено ===\n');
}

// Обработчик прерывания (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Сборка прервана пользователем');
  restoreAll();
  process.exit(130);
});

// Обработчик необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('\n❌ Критическая ошибка:', error.message);
  restoreAll();
  process.exit(1);
});

try {
  console.log('=== Подготовка к сборке статики ===\n');
  
  // 1. Чистим .next (там кэш TypeScript)
  if (fs.existsSync(nextDir)) {
    console.log('Удаляем .next (кэш)...');
    removeDir(nextDir);
    console.log('✓ Кэш очищен\n');
  }
  
  // 2. Бэкапим и удаляем API
  if (fs.existsSync(apiDir)) {
    console.log('Создаём бэкап API routes...');
    copyDir(apiDir, apiBackup);
    removeDir(apiDir);
    apiRemoved = true;
    console.log('✓ API routes временно удалены\n');
  }

  // 3. Бэкапим и патчим layout.tsx
  if (fs.existsSync(layoutPath)) {
    console.log('Патчим layout.tsx для статики...');
    fs.copyFileSync(layoutPath, layoutBackup);
    
    let layoutContent = fs.readFileSync(layoutPath, 'utf8');
    const originalContent = layoutContent;
    
    // Убираем все варианты force-dynamic
    layoutContent = layoutContent
      .replace(/export const dynamic = ['"]force-dynamic['"];?\s*/g, '')
      .replace(/export const dynamic=['"]force-dynamic['"];?\s*/g, '');
    
    if (layoutContent !== originalContent) {
      fs.writeFileSync(layoutPath, layoutContent);
      layoutPatched = true;
      console.log('✓ force-dynamic временно удалён\n');
    } else {
      console.log('⚠️  force-dynamic не найден (это нормально)\n');
    }
  }

  console.log('=== Запускаем сборку ===\n');
  
  execSync('npx next build', {
    env: { ...process.env, STATIC_EXPORT: '1' },
    stdio: 'inherit',
    cwd: rootDir,
  });

  console.log('\n✅ Статика успешно собрана в папке out/\n');
  
} catch (error) {
  console.error('\n❌ Ошибка при сборке');
  if (error.message) {
    console.error('Детали:', error.message);
  }
  restoreAll();
  process.exit(1);
}

// Всегда восстанавливаем в конце
restoreAll();
console.log('Готово! Все файлы восстановлены в исходное состояние.');