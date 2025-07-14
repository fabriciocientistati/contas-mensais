import { toast } from 'react-toastify';

export function handleApiError(
    error: any,
    setErrors?: (errors: Record<string, string[]>) => void
) {
    const status = error.response?.status;
    const data = error.response?.data;

    if ((status === 400 || status === 422) && data?.errors) {
        setErrors?.(data.errors);
        toast.error('Corrija os campos informados.');
        return;
    }

    console.error('Erro inesperado:', error);
    toast.error('Erro ao salvar a conta. Tente novamente.');
}