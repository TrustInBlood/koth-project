import { useState, useCallback } from 'react';

export function useApi() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const request = useCallback(async (url, options = {}) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback((url) => request(url), [request]);

    const post = useCallback((url, body) => request(url, {
        method: 'POST',
        body: JSON.stringify(body)
    }), [request]);

    const put = useCallback((url, body) => request(url, {
        method: 'PUT',
        body: JSON.stringify(body)
    }), [request]);

    const del = useCallback((url) => request(url, {
        method: 'DELETE'
    }), [request]);

    return {
        loading,
        error,
        get,
        post,
        put,
        del
    };
}

export default useApi;
