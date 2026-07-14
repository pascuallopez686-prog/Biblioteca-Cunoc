const { loadLocalEnv } = require('./_lib/env');

function encodeStoragePath(pathString) {
  return pathString
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

async function listAllPdfsRecursively(url, key, bucket, prefix = '') {
  let results = [];
  const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefix: prefix,
      limit: 100,
      sortBy: { column: 'name', order: 'asc' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to list files: ${response.statusText} - ${errText}`);
  }

  const items = await response.json();
  for (const item of items) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // Es una carpeta, navegamos de forma recursiva
      try {
        const subFiles = await listAllPdfsRecursively(url, key, bucket, itemPath);
        results = results.concat(subFiles);
      } catch (err) {
        console.error(`Error listando subcarpeta ${itemPath}:`, err.message);
      }
    } else if (item.name.toLowerCase().endsWith('.pdf')) {
      // Es un archivo PDF
      const sizeMB = item.metadata?.size
        ? (item.metadata.size / 1048576).toFixed(2) + ' MB'
        : null;
      
      const cleanName = item.name.replace('.pdf', '').replace(/_/g, ' ');

      results.push({
        name: cleanName,
        path: itemPath,
        url: `${url}/storage/v1/object/public/${bucket}/${encodeStoragePath(itemPath)}`,
        size: sizeMB
      });
    }
  }
  return results;
}

module.exports = async (req, res) => {
  loadLocalEnv();
  
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!url || !key) {
    return res.status(500).json({ success: false, message: 'Supabase no está configurado en el servidor.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    const cleanUrl = url.replace(/\/$/, '');
    const allPdfs = await listAllPdfsRecursively(cleanUrl, key, 'documents');
    
    // Clasificamos los documentos:
    // AETSRO: los que están dentro de la carpeta 'docs-web'
    // Biblioteca/Drive: todos los demás
    const aetsroPdfs = allPdfs.filter(p => p.path.startsWith('docs-web/'));
    const drivePdfs = allPdfs.filter(p => !p.path.startsWith('docs-web/'));
    
    return res.status(200).json({ 
      success: true, 
      aetsroPdfs,
      drivePdfs
    });
  } catch (err) {
    console.error('Error en endpoint aetsro-documents:', err);
    return res.status(500).json({ success: false, message: 'Error interno al cargar documentos.' });
  }
};
