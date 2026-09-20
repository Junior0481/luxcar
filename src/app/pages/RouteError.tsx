import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function RouteError() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? `Não foi possível abrir esta página (${error.status})`
    : 'Ocorreu um erro inesperado';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground" role="alert">
            Seus dados continuam seguros. Atualize a página ou volte ao início para continuar.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Tentar novamente
            </Button>
            <Button asChild variant="outline">
              <Link to="/"><Home className="size-4" aria-hidden="true" />Voltar ao início</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
