export default function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const { content, filename } = typeof req.body === 'string' 
      ? Object.fromEntries(new URLSearchParams(req.body))
      : (req.body || {});
    
    const safeName = filename || 'DSR_Tractors_Report.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return res.status(200).send('\uFEFF' + (content || ''));
  }
  return res.status(405).send('Method Not Allowed');
}
