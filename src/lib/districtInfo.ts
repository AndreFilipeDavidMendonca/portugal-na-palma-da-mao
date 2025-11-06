export async function fetchDistrictInfo(name: string) {
    try {
        const wikiRes = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name + "_(distrito)")}`);
        const wikiData = await wikiRes.json();

        const description = wikiData.extract || "Descrição não disponível.";
        const image = wikiData.thumbnail?.source || null;

        return {
            name,
            description,
            image,
            founded: wikiData.timestamp ? new Date(wikiData.timestamp).getFullYear() : null,
        };
    } catch (err) {
        console.error("Erro ao obter dados da Wikipedia:", err);
        return { name, description: "Sem dados.", image: null, founded: null };
    }
}