import { useState, useEffect } from 'react';
import { ApiClientController } from '../_api-client/api-client-controller';
import { Types } from '../_api-client/session-service-client';

export const useSessionTypes = () => {
    const [types, setTypes] = useState<Types>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    let ApiClientController!: ApiClientController;

    const loadSessionTypes = async(): Promise<void> => {
        try {
            if(!ApiClientController) throw new Error('err');
            setLoading(true);
            setError(null);
            const service = await ApiClientController.getSessionService();
            const types = await service.getSessionTypes();
            setTypes(types);
        } catch(err) {
            setError(err instanceof Error ? err.message : 'Failed to load types!');
            console.error('Error loading session types', err);
        } finally {
            setLoading(false);
        }
    }

    const isValidType = (t: string): boolean => {
        return Object.keys(types).includes(t);
    }

    useEffect(() => {
        loadSessionTypes()
    }, []);
    return {
        types,
        loading,
        error,
        loadSessionTypes,
        isValidType
    }
}