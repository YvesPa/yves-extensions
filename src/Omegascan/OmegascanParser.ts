import {
    SourceManga,
    Chapter,
    ChapterDetails,
    PagedResults,
    PartialSourceManga
} from '@paperback/types'

import { CheerioAPI } from 'cheerio/lib/load'

import { 
    ChapterListItemReturn,
    ChaptersListReturn,
    OmegascanCarrouselReturn, 
    SearchListItemReturn, 
    SearchListReturn, 
    convertIdSlugToMangaId 
} from './OmegascanHelper'

export class WebtoonParser {
    parseDetails($: CheerioAPI, mangaId: string): SourceManga {
        const detailElement = $('#content')
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                image: this.parseDetailsThumbnail($),
                titles: [detailElement.find('h1').text()],
                author: detailElement.find('span.text-base').text()?.match(/\((.*)\)/)?.[1]?.trim() ?? '',
                artist: '',
                desc: detailElement.find('p').text().trim(),
                tags: [
                    App.createTagSection({
                        id: '0',
                        label: 'genres',
                        tags: detailElement.find('div.flex.flex-row > span').toArray().slice(1).map(genre => App.createTag({ id: $(genre).text(), label: $(genre).text() }))
                    })
                ],
                status: detailElement.find('div.flex.flex-row > span').first().text()
            })
        })
    }

    parseDetailsThumbnail($: CheerioAPI): string {
        const picElement = $('#content img')
        const thumbnailUrl =  picElement.attr('src')?.match(/url=([^&]*)/)?.[1] ?? ''
        return decodeURIComponent(thumbnailUrl)
    }

    parseChaptersList(data: ChaptersListReturn, pageNumber: number): {chapters: Chapter[], hasMore: boolean} {
        const chapters = data.data
            .filter(chapter => chapter.price === 0)
            .map(chapter => this.parseChapter(chapter))
        return { chapters: chapters, hasMore: pageNumber !== data.meta.last_page }
    }

    parseChapter(chapter: ChapterListItemReturn): Chapter {
        return App.createChapter({
            id: chapter.chapter_slug,
            chapNum: this.parseNum(chapter.chapter_name),
            name: chapter.chapter_title ?? '',
            time: new Date(chapter.created_at)
        })
    }

    parseNum(chapter_name: string) : number{
        const numTab = chapter_name.trim().split(' ')
        return Number(numTab[1])
    }
  
    parseChapterDetails($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails {
        const pages = $('#content div.container > div > img')
            .toArray()
            .map(a => $(a).attr('src') !== '' ?$(a).attr('src') ?? '' : $(a).attr('data-src') ?? '')

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseCarouselTitles(data: OmegascanCarrouselReturn[]): PagedResults {
        const items = data.map(elem => this.parseMangaFromCarouselElement(elem))
        return App.createPagedResults({
            results: items
        })
    }

    parseMangaFromCarouselElement(elem: OmegascanCarrouselReturn): PartialSourceManga {
        return App.createPartialSourceManga({
            mangaId: convertIdSlugToMangaId(elem.series.id, elem.series.series_slug),
            title: elem.series.title,
            image: elem.banner
        })
    }

    parseSearchResults(data: SearchListReturn): PagedResults {
        const items = data.data.map(item => this.parseSearchListItem(item))
        return App.createPagedResults({
            results: items,
            metadata: data.meta
        })
    }
    
    parseSearchListItem(item: SearchListItemReturn): PartialSourceManga {
        return App.createPartialSourceManga({
            mangaId: convertIdSlugToMangaId(item.id, item.series_slug),
            title: item.title,
            image: item.thumbnail
        })
    }
}
