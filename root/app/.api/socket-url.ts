import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
    const port = process.env.PORT || 3001;
    const host = req.headers.host?.split(':')[0] || 'localhost';
    const url = `http://${host}:${port}`;
    res.status(200).json({ url: url });
}