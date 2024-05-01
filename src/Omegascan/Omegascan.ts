import {
    SourceManga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    Request,
    Response,
    SourceIntents,
    SearchResultsProviding,
    ChapterProviding,
    MangaProviding,
    HomePageSectionsProviding,
    HomeSectionType
} from '@paperback/types'

import { WebtoonParser as OmegascanParser } from './OmegascanParser'
import { CheerioAPI } from 'cheerio/lib/load'

export const BASE_URL = 'https://omegascans.org'
export const API_URL = 'https://api.omegascans.org'


export const OmegascanInfo: SourceInfo = {
    version: '0.8.1',
    name: 'Omegascan',
    description: `Extension that pulls manga from ${BASE_URL}`,
    author: 'YvesPa',
    authorWebsite: 'http://github.com/YvesPa',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: BASE_URL,
    sourceTags: [],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.SETTINGS_UI
}

import * as cheerio from 'cheerio'
import { 
    ChaptersListReturn, 
    OmegascanMetadata, 
    convertMangaIdToId, 
    convertMangaIdToSlug
} from './OmegascanHelper'

export abstract class Omegascan implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    cheerio = cheerio;
    private parser = new OmegascanParser();

    requestManager = App.createRequestManager({
        requestsPerSecond: 10,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': BASE_URL + '/',
                    'Origin': BASE_URL,
                    'user-agent': await this.requestManager.getDefaultUserAgent()
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => {
                return response
            }
        }
    });

    async ExecRequest<TResult>(
        infos: { url: string, headers?: Record<string, string>, param?: string}, 
        parseMethods: (_: CheerioAPI) => TResult) : Promise<TResult> 
    {
        const request = App.createRequest({ ...infos, method: 'GET'})
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data as string)
        return parseMethods.call(this.parser, $)
    }

    async ExecApiRequest<TJson, TResult>(
        infos: { url: string, headers?: Record<string, string>, param?: string}, 
        parseMethods: (_: TJson) => TResult) : Promise<TResult> 
    {
        const request = App.createRequest({ ...infos, method: 'GET'})
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data as string) as TJson
        return parseMethods.call(this.parser, data)
    }

    getMangaShareUrl(mangaId: string): string {
        const slug = convertMangaIdToSlug(mangaId)
        return `${BASE_URL}/series/${slug}`
    }

    getMangaDetails(mangaId: string): Promise<SourceManga> {
        const slug = convertMangaIdToSlug(mangaId)
        return this.ExecRequest(
            { url: `${BASE_URL}/series/${slug}` }, 
            $ => this.parser.parseDetails($, mangaId))
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const chapters : Chapter[] = []
        const id = convertMangaIdToId(mangaId)
        const params = { page: 1, perPage: 30, series_id: id }
        let hasMore = false

        do {
            const result = await this.ExecApiRequest(
                { 
                    url: `${API_URL}/chapter/query`,
                    param: this.paramsToString(params) 
                },
                (data: ChaptersListReturn) => this.parser.parseChaptersList(data, params.page))

            chapters.push(...result.chapters)
            params.page++
            hasMore = result.hasMore
        } while (hasMore)
        
        return chapters
    }

    getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const slug = convertMangaIdToSlug(mangaId)
        return this.ExecRequest(
            { url: `${BASE_URL}/series/${slug}/${chapterId}` }, 
            $ => this.parser.parseChapterDetails($, mangaId, chapterId))
    }

    getCarouselTitles(): Promise<PagedResults> {
        return this.ExecApiRequest(
            { url: `${API_URL}/series/banners` }, 
            this.parser.parseCarouselTitles)
    }

    getLatestReleasesTitles(metadata?: OmegascanMetadata | undefined): Promise<PagedResults> {
        const param = { order: 'desc', orderBy: 'latest' }
        return this.getTitles(param, metadata)
    }

    getDailyTitles(metadata?: OmegascanMetadata | undefined): Promise<PagedResults> {
        const param = { order: 'desc', orderBy: 'day_views' }
        return this.getTitles(param, metadata)
    }

    getMostViewedTitles(metadata?: OmegascanMetadata | undefined): Promise<PagedResults> {
        const param = { order: 'desc', orderBy: 'latest' }
        return this.getTitles(param, metadata)
    }

    getTitles(queryParams: Record<string, string|number|undefined>,
        metadata?: OmegascanMetadata | undefined) : Promise<PagedResults>
    {
        if (metadata && metadata.current_page === metadata.last_page) 
            return Promise.resolve<PagedResults>(App.createPagedResults({}))

        const params = {
            ...queryParams,
            adult: true,
            page: (metadata?.current_page ?? 0) + 1,
            per_page: metadata?.per_page ?? 10
        }

        return this.ExecApiRequest(
            {
                url: `${API_URL}/query`,
                param: this.paramsToString(params)
            },
            this.parser.parseSearchResults)
    }

    getSearchResults(query: SearchRequest, metadata: OmegascanMetadata | undefined): Promise<PagedResults> {
        const params = { query_string: query.title }
        return this.getTitles(params, metadata)

    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections : {request: Promise<PagedResults>, section: HomeSection}[] = 
        [
            {
                request: this.getCarouselTitles(),
                section: App.createHomeSection({
                    id: 'test',
                    title: 'test',
                    containsMoreItems: true,
                    type: HomeSectionType.featured
                })
            },
            {
                request: this.getLatestReleasesTitles(),
                section: App.createHomeSection({
                    id: 'latest_releases',
                    title: 'Our latest releases on comics',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            },
            {
                request: this.getDailyTitles(),
                section: App.createHomeSection({
                    id: 'daily',
                    title: 'Daily trending',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            },
            {
                request: this.getMostViewedTitles(),
                section: App.createHomeSection({
                    id: 'most_viewed',
                    title: 'Most viewed all times',
                    containsMoreItems: true,
                    type: HomeSectionType.singleRowNormal
                })
            }
        ]

        const promises: Promise<void>[] = []
        for (const section of sections) {
            promises.push(section.request.then(items => {
                section.section.items = items.results
                sectionCallback(section.section)
            }))
        }

    }

    getViewMoreItems(homepageSectionId: string, metadata: OmegascanMetadata | undefined): Promise<PagedResults> {
        switch (homepageSectionId) {        
            case 'latest_releases':
                return  this.getLatestReleasesTitles(metadata)
            case 'daily':
                return  this.getDailyTitles(metadata)
            case 'most_viewed':
                return  this.getMostViewedTitles(metadata)
            default:
                throw new Error(`Invalid homeSectionId | ${homepageSectionId}`)
        }
    }

    paramsToString = (params: Record<string, unknown>): string => {
        return '?' + Object.keys(params).map(key => `${key}=${params[key]}`).join('&')
    } 
}
