import { toast } from 'react-toastify';

type ApiErrorResponse = {
    response?: {
        status?: number;
        data?: {
            errors?: Record<string, string[]>;
        };
    };
};

export function handleApiError(
    error: unknown,
    setErrors?: (errors: Record<string, string[]>) => void
) {
    const apiError = error as ApiErrorResponse;
    const status = apiError.response?.status;
    const data = apiError.response?.data;

    if ((status === 400 || status === 422) && data?.errors) {
        setErrors?.(data.errors);
        toast.error('Corrija os campos informados.');
        return;
    }

    console.error('Erro inesperado:', error);
    toast.error('Erro ao salvar a conta. Tente novamente.');
}
