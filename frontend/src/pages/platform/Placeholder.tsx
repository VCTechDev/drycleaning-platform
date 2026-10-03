interface PlatformPlaceholderProps {
    title: string;
    description: string;
}

function PlatformPlaceholder({
    title,
    description,
}: PlatformPlaceholderProps) {

    return (
        <main>
            <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-sm font-semibold text-blue-600">
                    Platform Admin
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    {title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    {description}
                </p>
            </section>
        </main>
    );
}

export default PlatformPlaceholder;
