export interface OmegascanCarrouselReturn 
{
    banner: string
    series:
    {
        series_slug: string
        id: number
        title: string
    }
}

export interface ChaptersListReturn
{
    meta: OmegascanMetadata
    data: ChapterListItemReturn[]
}

export interface ChapterListItemReturn
{
    chapter_name: string
    chapter_title: string | null
    chapter_slug: string
    created_at: string
    price: number
}

export interface SearchListReturn {
    meta: OmegascanMetadata
    data: SearchListItemReturn[]
}

export interface SearchListItemReturn {
    id: number
    title: string
    series_slug: string
    thumbnail: string
}

export interface OmegascanMetadata
{
    per_page?: number
    current_page: number
    last_page?: number
}

export const convertMangaIdToId = (mangaId: string): string => {
    const tab = mangaId.split('$$')
    return tab.length === 2 && tab[0] ? tab[0] : mangaId
}

export const convertMangaIdToSlug = (mangaId: string): string => {
    const tab = mangaId.split('$$')
    return tab.length === 2 && tab[1] ? tab[1] : mangaId
}

export const convertIdSlugToMangaId = (id: number, slug: string): string => {
    return `${id}$$${slug}`
}